<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Models\Booking;
use App\Models\Customer;
use App\Models\Service;
use App\Models\Stylist;
use App\Models\StylistTimeOff;
use Database\Seeders\SalonTestScenarioSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Disponibilités (RG-RES-01 à 03) : MÊMES CAS que frontend/src/mocks/availability.test.ts.
 * « Maintenant » est figé au dimanche 8 novembre 2026 à 10 h (travelTo).
 */
class AvailabilityTest extends TestCase
{
    use RefreshDatabase;

    private int $tresses;

    private int $nattes;

    private int $soin;

    private int $fatou;

    private int $bineta;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SalonTestScenarioSeeder::class); // deux coiffeuses, pause de midi, dimanche fermé
        $this->travelTo(Carbon::parse('2026-11-08 10:00:00', 'UTC'));
        $this->tresses = Service::where('slug', 'tresses-africaines')->value('id');
        $this->nattes = Service::where('slug', 'nattes-collees')->value('id');
        $this->soin = Service::where('slug', 'soin-profond-karite')->value('id');
        $this->fatou = Stylist::where('display_name', 'Fatou')->value('id');
        $this->bineta = Stylist::where('display_name', 'Bineta')->value('id');
    }

    private function slots(int $service, string $date, ?int $stylist = null): array
    {
        $query = http_build_query(array_filter(['service_id' => $service, 'date' => $date, 'stylist_id' => $stylist]));

        return $this->getJson("/api/v1/availability?{$query}")->assertOk()->json('data');
    }

    private function free(array $day): array
    {
        return array_values(array_map(fn ($s) => $s['time'], array_filter($day['slots'], fn ($s) => $s['available'])));
    }

    private function book(int $stylist, string $start, string $end, BookingStatus $status = BookingStatus::Confirmed): void
    {
        $customer = Customer::firstOrCreate(['phone' => '770000555'], ['first_name' => 'Test', 'last_name' => 'Client']);
        Booking::create([
            'reference' => 'RDV-TEST-'.uniqid(), 'customer_id' => $customer->id, 'service_id' => $this->soin, 'stylist_id' => $stylist,
            'status' => $status, 'starts_at' => $start, 'ends_at' => $end, 'service_name' => 'Test', 'duration_minutes' => 60, 'price' => 8000,
        ]);
    }

    public function test_une_prestation_de_3h_un_lundi_ne_deborde_ni_sur_la_pause_ni_apres_la_fermeture(): void
    {
        $times = array_column($this->slots($this->tresses, '2026-11-09')['slots'], 'time');
        $this->assertSame(['09:00', '09:30', '10:00', '14:00', '14:30', '15:00', '15:30', '16:00'], $times);
    }

    public function test_le_samedi_sans_pause_et_fermeture_a_20h(): void
    {
        $times = array_column($this->slots($this->tresses, '2026-11-14')['slots'], 'time');
        $this->assertSame('09:00', $times[0]);
        $this->assertSame('17:00', end($times));
        $this->assertContains('12:00', $times);
    }

    public function test_le_vendredi_la_pause_va_jusqua_15h(): void
    {
        $times = array_column($this->slots($this->soin, '2026-11-13')['slots'], 'time');
        $this->assertNotContains('14:00', $times);
        $this->assertContains('15:00', $times);
    }

    public function test_dimanche_ferme_fermeture_exceptionnelle_et_horizon_de_60_jours(): void
    {
        $sunday = $this->slots($this->tresses, '2026-11-15');
        $this->assertFalse($sunday['is_open']);
        $this->assertSame([], $sunday['slots']);

        $this->travelTo(Carbon::parse('2026-12-01 10:00:00', 'UTC'));
        $this->assertSame('Fermé : Noël', $this->slots($this->tresses, '2026-12-25')['closed_reason']);

        $this->travelTo(Carbon::parse('2026-11-08 10:00:00', 'UTC'));
        $this->assertFalse($this->slots($this->tresses, '2027-02-01')['is_open']);
    }

    public function test_un_creneau_a_moins_de_2h_est_affiche_mais_indisponible(): void
    {
        $this->travelTo(Carbon::parse('2026-11-09 09:15:00', 'UTC'));
        $status = array_column($this->slots($this->soin, '2026-11-09')['slots'], 'available', 'time');
        $this->assertFalse($status['09:00']);
        $this->assertFalse($status['11:00']); // 11:00 < 9:15 + 2 h
        $this->assertTrue($status['11:30']);
    }

    public function test_un_coiffeur_choisi_est_indisponible_sur_ses_rendez_vous_battement_inclus(): void
    {
        $this->book($this->fatou, '2026-11-09 10:00:00', '2026-11-09 13:15:00');
        $free = $this->free($this->slots($this->soin, '2026-11-09', $this->fatou));

        $this->assertNotContains('09:00', $free); // 09:00 + 1 h + 10 min de battement = 10:10 > 10:00
        $this->assertNotContains('09:30', $free);
        $this->assertNotContains('11:00', $free);
        $this->assertContains('14:00', $free);
    }

    public function test_peu_importe_le_creneau_reste_libre_si_un_autre_coiffeur_est_disponible(): void
    {
        $this->book($this->fatou, '2026-11-09 10:00:00', '2026-11-09 13:15:00');
        $this->assertContains('11:00', $this->free($this->slots($this->soin, '2026-11-09')));
    }

    public function test_une_reservation_annulee_libere_le_creneau(): void
    {
        $this->book($this->fatou, '2026-11-09 10:00:00', '2026-11-09 13:15:00', BookingStatus::Cancelled);
        $this->assertContains('10:00', $this->free($this->slots($this->soin, '2026-11-09', $this->fatou)));
    }

    public function test_les_conges_d_un_coiffeur_bloquent_ses_creneaux(): void
    {
        StylistTimeOff::create(['stylist_id' => $this->bineta, 'starts_at' => '2026-11-09 00:00:00', 'ends_at' => '2026-11-10 00:00:00', 'reason' => 'Formation']);
        $this->assertSame([], $this->free($this->slots($this->soin, '2026-11-09', $this->bineta)));
        $this->assertNotSame([], $this->free($this->slots($this->soin, '2026-11-09', $this->fatou)));
    }

    public function test_un_coiffeur_qui_ne_realise_pas_la_prestation_n_a_aucun_creneau(): void
    {
        // Bineta ne fait pas les nattes collées : la demander explicitement ne donne rien
        $this->assertSame([], $this->free($this->slots($this->nattes, '2026-11-09', $this->bineta)));
    }

    public function test_parametres_invalides(): void
    {
        $this->getJson('/api/v1/availability?service_id=999&date=09/11/2026')->assertUnprocessable()->assertJsonValidationErrors(['service_id', 'date']);
    }
}
