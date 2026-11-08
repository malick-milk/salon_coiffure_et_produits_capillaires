<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Customer;
use App\Models\Order;
use App\Models\SatisfactionSurvey;
use App\Models\User;
use App\Notifications\SatisfactionSurveyRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Tests\TestCase;

/** Étape 13 : enquêtes de satisfaction, avis publics, modération, rappel des mécontentes, indicateurs */
class SatisfactionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(Carbon::parse('2026-11-08 10:00:00', 'UTC'));
    }

    private function admin(): User
    {
        return User::where('email', 'admin@dabohair.test')->first();
    }

    private function mariama(): Customer
    {
        return Customer::where('email', 'mariama@client.test')->first();
    }

    /** Enquête prête à remplir ; renvoie [enquête, lien en clair] */
    private function survey(array $attributes = []): array
    {
        $token = Str::random(40);
        $survey = SatisfactionSurvey::create([
            'token_hash' => SatisfactionSurvey::hashToken($token), 'customer_id' => $this->mariama()->id,
            'kind' => 'booking', 'subject_label' => 'Micro twist', 'sent_at' => now(), 'expires_at' => now()->addDays(14),
            ...$attributes,
        ]);

        return [$survey, $token];
    }

    private function answered(int $rating, ?int $nps, string $status = 'pending', array $extra = []): SatisfactionSurvey
    {
        $c = Customer::create(['first_name' => 'Cliente', 'last_name' => 'Test'.Str::random(4), 'phone' => '77'.random_int(1000000, 9999999)]);

        return $this->survey(['customer_id' => $c->id, 'answered_at' => now(), 'rating' => $rating, 'nps' => $nps, 'comment' => 'Avis',
            'publish_consent' => $status !== 'none', 'review_status' => $status, ...$extra])[0];
    }

    // ---------- Envoi ----------

    public function test_l_enquete_part_le_lendemain_d_une_prestation_terminee_une_seule_fois(): void
    {
        Notification::fake();
        Booking::where('reference', 'RDV-2026-000105')->update(['completed_at' => now()->subDay()]);

        $this->artisan('surveys:send')->expectsOutput('1 enquête(s) envoyée(s).')->assertSuccessful();
        $this->artisan('surveys:send')->expectsOutput('0 enquête(s) envoyée(s).');

        $survey = SatisfactionSurvey::sole();
        $this->assertSame('booking', $survey->kind);
        $this->assertSame(64, strlen($survey->token_hash)); // empreinte, jamais le lien en clair
        Notification::assertSentTo($this->mariama(), SatisfactionSurveyRequest::class, function (SatisfactionSurveyRequest $n) use ($survey) {
            return SatisfactionSurvey::hashToken($n->token) === $survey->token_hash
                && str_contains($n->toSms($this->mariama())->text, "http://localhost:5173/avis/{$n->token}");
        });
    }

    public function test_pas_d_enquete_le_jour_meme_ni_trop_tard_ni_deux_fois_en_14_jours(): void
    {
        Notification::fake();
        $booking = Booking::where('reference', 'RDV-2026-000105')->first();
        $booking->update(['completed_at' => now()->subHour()]);
        $this->artisan('surveys:send')->expectsOutput('0 enquête(s) envoyée(s).'); // aujourd'hui : on attend demain
        $booking->update(['completed_at' => now()->subDays(9)]);
        $this->artisan('surveys:send')->expectsOutput('0 enquête(s) envoyée(s).'); // plus de 7 jours : trop tard

        $booking->update(['completed_at' => now()->subDay()]);
        $this->survey(['sent_at' => now()->subDays(5)]); // déjà interrogée il y a 5 jours
        $this->artisan('surveys:send')->expectsOutput('0 enquête(s) envoyée(s).');
    }

    public function test_une_commande_livree_declenche_aussi_une_enquete(): void
    {
        Notification::fake();
        Order::where('reference', 'CMD-2026-000009')->update(['status' => 'delivered', 'delivered_at' => now()->subDays(2)]);
        $this->artisan('surveys:send')->assertSuccessful();
        $this->assertDatabaseHas('satisfaction_surveys', ['kind' => 'order', 'subject_label' => 'Commande CMD-2026-000009']);
    }

    // ---------- Réponse de la cliente ----------

    public function test_la_cliente_ouvre_son_lien_et_repond_une_seule_fois(): void
    {
        [$survey, $token] = $this->survey();
        $this->getJson("/api/v1/surveys/{$token}")->assertOk()
            ->assertJsonPath('data.state', 'open')->assertJsonPath('data.first_name', 'Mariama')->assertJsonPath('data.subject_label', 'Micro twist');

        $this->postJson("/api/v1/surveys/{$token}", ['rating' => 6, 'publish_consent' => true])->assertJsonValidationErrors(['rating']);
        $this->postJson("/api/v1/surveys/{$token}", ['rating' => 5, 'nps' => 10, 'comment' => '  Parfait !  ', 'publish_consent' => true])
            ->assertCreated()->assertJsonPath('data.follow_up', false);

        $survey->refresh();
        $this->assertSame([5, 10, 'Parfait !', 'pending'], [$survey->rating, $survey->nps, $survey->comment, $survey->review_status]);
        $this->postJson("/api/v1/surveys/{$token}", ['rating' => 1, 'publish_consent' => false])->assertStatus(409);
        $this->getJson("/api/v1/surveys/{$token}")->assertJsonPath('data.state', 'answered');
    }

    public function test_lien_inconnu_404_et_lien_expire_410(): void
    {
        $this->getJson('/api/v1/surveys/'.Str::random(40))->assertNotFound();
        $this->getJson('/api/v1/surveys/trop-court')->assertNotFound();
        [, $token] = $this->survey(['expires_at' => now()->subMinute()]);
        $this->getJson("/api/v1/surveys/{$token}")->assertJsonPath('data.state', 'expired');
        $this->postJson("/api/v1/surveys/{$token}", ['rating' => 4, 'publish_consent' => false])->assertStatus(410);
    }

    public function test_une_note_basse_peut_etre_publiee_et_demande_un_rappel(): void
    {
        [$survey, $token] = $this->survey();
        $this->postJson("/api/v1/surveys/{$token}", ['rating' => 2, 'comment' => 'Trop d’attente', 'publish_consent' => true])
            ->assertCreated()->assertJsonPath('data.follow_up', true);
        $this->assertSame('pending', $survey->fresh()->review_status); // pas de tri des seuls bons avis
        $this->assertTrue($survey->fresh()->needsFollowUp());
    }

    public function test_sans_accord_l_avis_reste_prive(): void
    {
        [$survey, $token] = $this->survey();
        $this->postJson("/api/v1/surveys/{$token}", ['rating' => 5, 'publish_consent' => false])->assertCreated();
        $this->assertSame('none', $survey->fresh()->review_status);
    }

    // ---------- Avis publics ----------

    public function test_seuls_les_avis_valides_sont_publics_mais_la_moyenne_compte_toutes_les_reponses(): void
    {
        $this->answered(5, 10, 'approved', ['reply' => 'Merci !']);
        $this->answered(4, 8, 'pending');
        $this->answered(1, 2, 'none');

        $res = $this->getJson('/api/v1/reviews')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.rating', 5)->assertJsonPath('data.0.reply', 'Merci !')
            ->assertJsonPath('summary.answered_count', 3)->assertJsonPath('summary.published_count', 1)
            ->assertJsonPath('summary.distribution.1', 1);
        $this->assertEquals(3.3, $res->json('summary.average'));
        $this->assertMatchesRegularExpression('/^Cliente T\.$/', $res->json('data.0.author')); // jamais le nom complet
        $this->assertArrayNotHasKey('customer_phone', $res->json('data.0'));
    }

    // ---------- ERP ----------

    public function test_seuls_le_proprietaire_et_la_gerante_moderent(): void
    {
        $this->getJson('/api/v1/admin/surveys')->assertUnauthorized();
        $this->actingAs(tap(User::factory()->create())->assignRole('cashier'))->getJson('/api/v1/admin/surveys')->assertForbidden();
        $this->actingAs(tap(User::factory()->create())->assignRole('manager'))->getJson('/api/v1/admin/surveys')->assertOk();
    }

    public function test_publier_repondre_refuser_et_journal_d_audit(): void
    {
        $s = $this->answered(5, 10, 'pending');
        $this->actingAs($this->admin());
        $this->getJson('/api/v1/admin/surveys')->assertOk()->assertJsonPath('counts.to_moderate', 1)->assertJsonPath('data.0.id', $s->id);

        $this->patchJson("/api/v1/admin/surveys/{$s->id}/review", ['decision' => 'reply', 'reply' => 'Merci'])->assertJsonValidationErrors(['decision']);
        $this->patchJson("/api/v1/admin/surveys/{$s->id}/review", ['decision' => 'approve', 'reply' => 'Merci beaucoup !'])->assertOk()
            ->assertJsonPath('data.review_status', 'approved')->assertJsonPath('data.reply', 'Merci beaucoup !');
        $this->patchJson("/api/v1/admin/surveys/{$s->id}/review", ['decision' => 'reply', 'reply' => 'À bientôt'])->assertOk()->assertJsonPath('data.reply', 'À bientôt');

        $this->patchJson("/api/v1/admin/surveys/{$s->id}/review", ['decision' => 'reject'])->assertJsonValidationErrors(['reject_reason']);
        $this->patchJson("/api/v1/admin/surveys/{$s->id}/review", ['decision' => 'reject', 'reject_reason' => 'insultes'])->assertOk()
            ->assertJsonPath('data.review_status', 'rejected')->assertJsonPath('data.reply', null);
        $this->assertDatabaseHas('activity_log', ['log_name' => 'reviews', 'subject_id' => $s->id, 'causer_id' => $this->admin()->id]);

        $private = $this->answered(5, 10, 'none');
        $this->patchJson("/api/v1/admin/surveys/{$private->id}/review", ['decision' => 'approve'])->assertJsonValidationErrors(['decision']);
    }

    public function test_rappeler_une_cliente_mecontente(): void
    {
        $s = $this->answered(2, 3, 'none');
        $this->actingAs($this->admin());
        $this->getJson('/api/v1/admin/surveys?filter=follow_up')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.needs_follow_up', true)->assertJsonPath('counts.follow_up', 1);
        $this->patchJson("/api/v1/admin/surveys/{$s->id}/follow-up", ['note' => 'ok'])->assertJsonValidationErrors(['note']);
        $this->patchJson("/api/v1/admin/surveys/{$s->id}/follow-up", ['note' => 'Rappelée, geste offert sur le prochain soin'])->assertOk()
            ->assertJsonPath('data.needs_follow_up', false);
        $this->getJson('/api/v1/admin/surveys?filter=follow_up')->assertJsonCount(0, 'data');

        [$open] = $this->survey();
        $this->patchJson("/api/v1/admin/surveys/{$open->id}/follow-up", ['note' => 'Pas encore de réponse'])->assertStatus(422);
    }

    public function test_indicateurs_note_moyenne_nps_taux_de_reponse_par_prestation_et_par_mois(): void
    {
        $stylist = Booking::where('reference', 'RDV-2026-000105')->value('stylist_id');
        $this->answered(5, 10, 'approved', ['stylist_id' => $stylist]);   // promotrice
        $this->answered(4, 9, 'none', ['stylist_id' => $stylist]);        // promotrice
        $this->answered(3, 7, 'none', ['subject_label' => 'Brushing']);   // neutre
        $this->answered(1, 2, 'none', ['subject_label' => 'Brushing']);   // détractrice
        $this->answered(5, null, 'none', ['kind' => 'order', 'subject_label' => 'Commande CMD-2026-000001']);
        $this->survey(); // envoyée, sans réponse

        $d = $this->actingAs($this->admin())->getJson('/api/v1/admin/surveys/stats')->assertOk()->json('data');
        $this->assertSame(6, $d['sent']);
        $this->assertSame(5, $d['answered']);
        $this->assertEquals(83.3, $d['response_rate']);
        $this->assertEquals(3.6, $d['average_rating']);
        $this->assertSame(25, $d['nps']);           // (2 promotrices − 1 détractrice) / 4 réponses × 100
        $this->assertSame(4, $d['nps_answers']);
        $this->assertSame(['Micro twist', 'Brushing'], array_column($d['by_service'], 'label'));
        $this->assertEquals(4.5, $d['by_service'][0]['average']);
        $this->assertSame(1, (int) $d['orders']['answered']);
        $this->assertSame(2, $d['by_stylist'][0]['answered']);
        $this->assertSame('2026-11', $d['by_month'][0]['month']);
        $this->assertSame(2, $d['counts']['follow_up']);

        $this->getJson('/api/v1/admin/surveys/stats?from=2026-12-01&to=2026-11-01')->assertJsonValidationErrors(['to']);
    }
}
