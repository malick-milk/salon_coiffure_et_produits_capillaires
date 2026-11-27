<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Models\Booking;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\EmploymentContract;
use App\Models\Service;
use App\Models\Stylist;
use App\Models\User;
use Database\Seeders\DemoHrSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Spatie\Activitylog\Models\Activity;
use Tests\TestCase;

/** Contrats et RH (maquette validée le 26 novembre 2026) : propriétaire seulement, règles des CDD, documents privés */
class HrContractsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        // Horloge figée AVANT les seeders : les contrats de démo sont datés par rapport à « aujourd'hui »
        Carbon::setTestNow('2026-11-26 10:00:00');
        parent::setUp();
        // La base de démonstration n'est remplie qu'UNE fois par série de tests, parfois par une autre classe, à la
        // vraie date du jour : on recrée l'équipe de démo sous l'horloge figée (bug du 27 novembre 2026, « 19 jours »).
        Employee::query()->delete();
        (new DemoHrSeeder)->run();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function actingAsRole(string $role): User
    {
        $this->flushSession();
        $this->app['auth']->forgetGuards();
        $user = tap(User::factory()->create())->assignRole($role);
        $this->actingAs($user);

        return $user;
    }

    private function hire(array $over = []): TestResponse
    {
        return $this->postJson('/api/v1/admin/hr/employees', [
            'first_name' => 'Aïda', 'last_name' => 'Sy', 'phone' => '77 222 33 44', 'id_number' => '1 987 2000 55555',
            'type' => 'cdd', 'position' => 'Coiffeuse', 'starts_on' => '2026-12-01', 'ends_on' => '2027-05-31',
            'base_salary' => 90000, 'commission_rate' => 10, 'pay_method' => 'wave', ...$over,
        ]);
    }

    private function fatou(): EmploymentContract
    {
        return Employee::where('first_name', 'Fatou')->firstOrFail()->currentContract;
    }

    public function test_seule_la_proprietaire_voit_les_contrats(): void
    {
        foreach (['manager', 'cashier', 'stylist', 'stock_keeper', 'customer'] as $role) {
            $this->actingAsRole($role);
            $this->getJson('/api/v1/admin/hr/employees')->assertForbidden();
            $this->getJson('/api/v1/admin/hr/employees/'.Employee::value('id'))->assertForbidden();
        }
        $this->actingAsRole('super_admin');
        $this->getJson('/api/v1/admin/hr/employees')->assertOk()->assertJsonCount(4, 'data');
    }

    public function test_les_alertes_de_la_maquette(): void
    {
        $this->actingAsRole('super_admin');
        $res = $this->getJson('/api/v1/admin/hr/employees')->assertOk();
        $titles = collect($res->json('alerts'))->pluck('title')->all();
        $this->assertSame(['Contrat non signé', 'Fin de période d’essai le 3 décembre 2026', 'Fin de CDD dans 18 jours'], $titles);
        $this->assertSame(200000, $res->json('payroll.base_total'));
        $this->assertSame(['ending', 'trial', 'unsigned', 'active'], collect($res->json('data'))->pluck('state')->all());
    }

    public function test_embaucher_et_les_numeros_sont_chiffres_en_base(): void
    {
        $this->actingAsRole('super_admin');
        $id = $this->hire()->assertCreated()->assertJsonPath('data.contract.type', 'cdd')->assertJsonPath('data.employee.id_number', '1 987 2000 55555')->json('data.id');

        $raw = DB::table('employees')->where('id', $id)->value('id_number');
        $this->assertNotSame('1 987 2000 55555', $raw);
        $this->assertStringNotContainsString('55555', (string) json_encode(Activity::where('log_name', 'hr')->get()->pluck('properties')), 'Le journal d’audit ne garde jamais le n° CNI');
    }

    public function test_les_regles_de_dates_des_contrats(): void
    {
        $this->actingAsRole('super_admin');
        $this->hire(['ends_on' => null])->assertUnprocessable()->assertJsonValidationErrors('ends_on');
        $this->hire(['ends_on' => '2029-01-01'])->assertUnprocessable()->assertJsonPath('errors.ends_on.0', 'Un CDD dure 2 ans au plus (Code du travail, art. 100).');
        $this->hire(['type' => 'cdi'])->assertUnprocessable()->assertJsonValidationErrors('ends_on');
        $this->hire(['type' => 'cdi', 'ends_on' => null])->assertCreated();
        $this->hire(['trial_ends_on' => '2026-11-01'])->assertUnprocessable()->assertJsonValidationErrors('trial_ends_on');
    }

    public function test_un_cdd_ne_se_renouvelle_qu_une_fois(): void
    {
        $this->actingAsRole('super_admin');
        $c = $this->fatou();
        $this->postJson("/api/v1/admin/hr/contracts/{$c->id}/renew", ['ends_on' => '2026-12-01'])->assertUnprocessable();
        $this->postJson("/api/v1/admin/hr/contracts/{$c->id}/renew", ['ends_on' => '2027-06-14'])->assertOk()
            ->assertJsonPath('data.contract.renewal_count', 1)->assertJsonPath('data.contract.ends_on', '2027-06-14')->assertJsonPath('data.contract.can_renew', false);
        $this->postJson("/api/v1/admin/hr/contracts/{$c->id}/renew", ['ends_on' => '2027-12-14'])->assertUnprocessable()
            ->assertJsonPath('errors.ends_on.0', fn ($m) => str_contains($m, 'un seul renouvellement'));
    }

    public function test_les_cdd_cumules_ne_depassent_pas_quatre_ans(): void
    {
        $this->actingAsRole('super_admin');
        $c = $this->fatou();
        // 3 ans de CDD terminés avant, chez Dabo Hair
        $c->employee->contracts()->create(['type' => 'cdd', 'position' => 'Coiffeuse', 'starts_on' => '2022-12-01', 'ends_on' => '2024-11-30', 'ended_on' => '2024-11-30', 'end_reason' => 'end_of_term']);
        $c->employee->contracts()->create(['type' => 'cdd', 'position' => 'Coiffeuse', 'starts_on' => '2024-12-01', 'ends_on' => '2025-11-30', 'ended_on' => '2025-11-30', 'end_reason' => 'end_of_term']);
        $this->postJson("/api/v1/admin/hr/contracts/{$c->id}/renew", ['ends_on' => '2027-12-14'])->assertUnprocessable()
            ->assertJsonPath('errors.ends_on.0', fn ($m) => str_contains($m, '4 ans au total'));
    }

    public function test_passer_en_cdi(): void
    {
        $this->actingAsRole('super_admin');
        $c = $this->fatou();
        $res = $this->postJson("/api/v1/admin/hr/contracts/{$c->id}/convert", ['starts_on' => '2026-12-15'])->assertOk();
        $res->assertJsonPath('data.contract.type', 'cdi')->assertJsonPath('data.contract.ends_on', null)->assertJsonPath('data.contract.base_salary', 90000);
        $this->assertSame(['2026-12-14', 'converted'], [$c->fresh()->ended_on->toDateString(), $c->fresh()->end_reason]);
        $this->assertSame($c->id, EmploymentContract::latest('id')->first()->previous_contract_id);
    }

    public function test_terminer_un_contrat_le_range_dans_les_contrats_termines(): void
    {
        $this->actingAsRole('super_admin');
        $c = $this->fatou();
        $this->postJson("/api/v1/admin/hr/contracts/{$c->id}/terminate", ['ended_on' => '2026-12-14', 'end_reason' => 'end_of_term'])->assertOk();
        $list = $this->getJson('/api/v1/admin/hr/employees')->assertOk();
        $this->assertSame(['Fatou Ndiaye'], collect($list->json('ended'))->pluck('name')->all());
        $this->assertNotContains('Fatou Ndiaye', collect($list->json('data'))->pluck('name')->all());
        $this->postJson("/api/v1/admin/hr/contracts/{$c->id}/terminate", ['ended_on' => '2026-12-14', 'end_reason' => 'end_of_term'])->assertUnprocessable();
    }

    public function test_un_cdd_depasse_est_signale(): void
    {
        $this->actingAsRole('super_admin');
        $this->fatou()->update(['ends_on' => '2026-11-20']);
        $alerts = collect($this->getJson('/api/v1/admin/hr/employees')->json('alerts'));
        $this->assertSame('overdue', $alerts->firstWhere('employee_id', $this->fatou()->employee_id)['kind']);
    }

    public function test_la_commission_vient_des_prestations_realisees_du_planning(): void
    {
        $this->actingAsRole('super_admin');
        $stylist = Stylist::create(['display_name' => 'Fatou N.', 'is_active' => true]);
        $c = $this->fatou();
        $c->employee->update(['stylist_id' => $stylist->id]);
        $service = Service::where('slug', 'twist-simple')->firstOrFail();
        foreach ([[BookingStatus::Completed, 5000, 1], [BookingStatus::Completed, 7000, 2], [BookingStatus::Cancelled, 9000, 3], [BookingStatus::Completed, 4000, -30]] as $i => [$status, $price, $day]) {
            $start = Carbon::parse('2026-11-01 10:00')->addDays($day);
            Booking::create(['reference' => 'RDV-T-'.$i, 'customer_id' => Customer::value('id'), 'service_id' => $service->id, 'stylist_id' => $stylist->id, 'status' => $status, 'starts_at' => $start, 'ends_at' => $start->copy()->addHour(),
                'service_name' => $service->name, 'duration_minutes' => 60, 'price' => $price]);
        }
        $this->getJson("/api/v1/admin/hr/employees/{$c->employee_id}")->assertOk()
            ->assertJsonPath('data.contract.commission.revenue', 12000)->assertJsonPath('data.contract.commission.commission', 1200);
    }

    public function test_le_contrat_signe_est_prive_et_retire_l_alerte(): void
    {
        Storage::fake('local');
        $this->actingAsRole('super_admin');
        $mariama = Employee::where('first_name', 'Mariama')->firstOrFail();
        $res = $this->post("/api/v1/admin/hr/employees/{$mariama->id}/documents", ['kind' => 'contract', 'document' => UploadedFile::fake()->create('contrat.pdf', 120, 'application/pdf')], ['Accept' => 'application/json'])->assertCreated();
        $doc = $res->json('data.documents.0');
        $this->assertNotNull($res->json('data.contract.signed_on'));
        $this->assertSame([], collect($res->json('data.contract.alerts'))->where('kind', 'unsigned')->all());
        $path = DB::table('employee_documents')->value('path');
        Storage::disk('local')->assertExists($path);
        $this->assertStringStartsWith('hr/', $path);

        $this->get("/api/v1/admin/hr/documents/{$doc['id']}")->assertOk()->assertHeader('content-disposition');
        $this->actingAsRole('manager');
        $this->get("/api/v1/admin/hr/documents/{$doc['id']}", ['Accept' => 'application/json'])->assertForbidden();
        $this->post("/api/v1/admin/hr/employees/{$mariama->id}/documents", ['kind' => 'other', 'document' => UploadedFile::fake()->create('x.exe', 10)], ['Accept' => 'application/json'])->assertForbidden();
    }

    public function test_un_fichier_non_accepte_est_refuse(): void
    {
        Storage::fake('local');
        $this->actingAsRole('super_admin');
        $id = Employee::value('id');
        $this->post("/api/v1/admin/hr/employees/{$id}/documents", ['kind' => 'other', 'document' => UploadedFile::fake()->create('virus.exe', 10)], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonPath('errors.document.0', 'Formats acceptés : PDF, JPG ou PNG.');
    }

    public function test_conges_et_historique(): void
    {
        $this->actingAsRole('super_admin');
        $c = $this->fatou();
        $this->postJson("/api/v1/admin/hr/employees/{$c->employee_id}/leaves", ['kind' => 'paid', 'starts_on' => '2026-08-03', 'ends_on' => '2026-08-08', 'days' => 6])->assertCreated()
            ->assertJsonPath('data.leave_balance.taken', 6)->assertJsonPath('data.leave_balance.acquired', 20);
        $this->patchJson("/api/v1/admin/hr/employees/{$c->employee_id}", ['commission_rate' => 12])->assertOk();
        $events = collect($this->getJson("/api/v1/admin/hr/employees/{$c->employee_id}")->json('data.history'))->pluck('event');
        $this->assertContains('updated', $events);
        $this->assertContains('leave_added', $events);
    }

    public function test_le_contrat_se_telecharge(): void
    {
        $this->actingAsRole('super_admin');
        $res = $this->get('/api/v1/admin/hr/contracts/'.$this->fatou()->id.'/pdf')->assertOk()->assertHeader('content-type', 'application/pdf');
        // Pièce jointe : le navigateur l'enregistre, on l'ouvre ensuite pour l'imprimer
        $this->assertStringContainsString('attachment; filename=contrat-fatou-ndiaye.pdf', (string) $res->headers->get('content-disposition'));
    }

    /** Bug du 26 novembre : le journal d'audit plantait (chargement paresseux de la personne d'un contrat) */
    public function test_le_journal_d_audit_affiche_les_contrats(): void
    {
        $this->actingAsRole('super_admin');
        $labels = collect($this->getJson('/api/v1/admin/audit?log=hr')->assertOk()->json('data'))->pluck('subject_label');
        $this->assertContains('Contrat de Fatou Ndiaye', $labels->all());
        $this->assertContains('Mariama Diop', $labels->all());
    }
}
