<?php

namespace Tests\Feature;

use App\Actions\Admin\ChangeBookingStatusAction;
use App\Enums\BookingStatus;
use App\Models\Booking;
use App\Models\Customer;
use App\Models\SatisfactionSurvey;
use App\Models\Service;
use App\Models\User;
use App\Notifications\BookingCancelledByCustomer;
use App\Notifications\BookingCancelledBySalon;
use App\Notifications\BookingConfirmed;
use App\Notifications\BookingReceived;
use App\Notifications\BookingReminder;
use App\Notifications\Channels\SmsChannel;
use App\Notifications\SatisfactionSurveyRequest;
use App\Services\Sms\SmsSender;
use Database\Seeders\SalonTestScenarioSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use RuntimeException;
use Tests\TestCase;

/** Étape 13 : SMS et e-mails envoyés aux clientes, motif d'annulation obligatoire */
class NotificationsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SalonTestScenarioSeeder::class); // deux coiffeuses, pause de midi, dimanche fermé
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

    private function bookingPayload(array $customer): array
    {
        return [
            'service_id' => Service::where('slug', 'nattes-collees')->value('id'), 'stylist_id' => null,
            'date' => '2026-11-09', 'time' => '14:00', 'customer' => $customer, 'notes' => null, 'consent' => true,
        ];
    }

    public function test_une_reservation_en_ligne_previent_la_cliente_par_sms_et_par_e_mail(): void
    {
        Notification::fake();
        $this->postJson('/api/v1/bookings', $this->bookingPayload(['first_name' => 'Khady', 'last_name' => 'Fall', 'phone' => '76 111 22 33', 'email' => 'khady@exemple.sn']))->assertCreated();

        $khady = Customer::where('phone', '761112233')->first();
        Notification::assertSentTo($khady, BookingReceived::class, function (BookingReceived $n, array $channels) use ($khady) {
            $sms = $n->toSms($khady)->text;

            return $channels === [SmsChannel::class, 'mail'] && str_contains($sms, 'Nattes collées') && str_contains($sms, 'lundi 9 novembre à 14h00');
        });
    }

    public function test_sans_e_mail_seul_le_sms_part_et_sans_numero_valide_seul_l_e_mail(): void
    {
        Notification::fake();
        $this->postJson('/api/v1/bookings', $this->bookingPayload(['first_name' => 'Awa', 'last_name' => 'Ba', 'phone' => '78 000 11 22', 'email' => null]))->assertCreated();
        Notification::assertSentTo(Customer::where('phone', '780001122')->first(), BookingReceived::class, fn ($n, $channels) => $channels === [SmsChannel::class]);

        $c = Customer::create(['first_name' => 'Léa', 'last_name' => 'Martin', 'phone' => '0612345678', 'email' => 'lea@exemple.fr']);
        $this->assertSame(['mail'], (new BookingReceived(Booking::first()))->via($c));
    }

    public function test_le_salon_doit_donner_un_motif_pour_annuler_et_la_cliente_le_recoit(): void
    {
        Notification::fake();
        $this->actingAs($this->admin());
        $this->patchJson('/api/v1/admin/bookings/RDV-2026-000201/status', ['status' => 'cancelled'])->assertJsonValidationErrors(['reason']);
        $this->patchJson('/api/v1/admin/bookings/RDV-2026-000201/status', ['status' => 'cancelled', 'reason' => '  '])->assertJsonValidationErrors(['reason']);
        Notification::assertNothingSent();

        $this->patchJson('/api/v1/admin/bookings/RDV-2026-000201/status', ['status' => 'cancelled', 'reason' => 'Coiffeuse malade'])->assertOk();
        Notification::assertSentTo($this->mariama(), BookingCancelledBySalon::class, function (BookingCancelledBySalon $n) {
            $mail = $n->toMail($this->mariama());

            return str_contains($n->toSms($this->mariama())->text, 'Motif : Coiffeuse malade')
                && str_contains($n->toSms($this->mariama())->text, 'http://localhost:5173/reserver')
                && $mail->actionUrl === 'http://localhost:5173/reserver'
                && in_array('**Motif :** Coiffeuse malade', $mail->introLines, true);
        });
    }

    public function test_la_cliente_voit_le_motif_du_salon_dans_son_compte(): void
    {
        Notification::fake();
        // Annulation par le salon (l'action métier directement : un seul utilisateur connecté par test)
        app(ChangeBookingStatusAction::class)->execute(Booking::where('reference', 'RDV-2026-000201')->first(), BookingStatus::Cancelled, 'Fermeture exceptionnelle');
        $this->actingAs(User::where('email', 'mariama@client.test')->first())->getJson('/api/v1/me/bookings')->assertOk()
            ->assertJsonPath('data.0.cancelled_by', 'staff')
            ->assertJsonPath('data.0.cancellation_reason', 'Fermeture exceptionnelle');
    }

    public function test_confirmer_previent_la_cliente(): void
    {
        Notification::fake();
        Booking::where('reference', 'RDV-2026-000201')->update(['status' => 'pending']);
        $this->actingAs($this->admin())->patchJson('/api/v1/admin/bookings/RDV-2026-000201/status', ['status' => 'confirmed'])->assertOk();
        Notification::assertSentTo($this->mariama(), BookingConfirmed::class, fn (BookingConfirmed $n) => str_contains($n->toMail($this->mariama())->subject, 'Rendez-vous confirmé'));
    }

    public function test_l_annulation_par_la_cliente_lui_est_confirmee(): void
    {
        Notification::fake();
        $this->actingAs(User::where('email', 'mariama@client.test')->first())->postJson('/api/v1/me/bookings/RDV-2026-000201/cancel')->assertOk()
            ->assertJsonPath('data.cancellation_reason', null); // motif seulement si le salon annule
        Notification::assertSentTo($this->mariama(), BookingCancelledByCustomer::class);
    }

    public function test_rappel_de_la_veille_envoye_une_seule_fois(): void
    {
        Notification::fake();
        // La veille du rendez-vous RDV-2026-000201, quelle que soit la date du jour (les données de démo sont relatives)
        $this->travelTo(Booking::where('reference', 'RDV-2026-000201')->value('starts_at')->copy()->subDay()->setTime(17, 0));
        $this->artisan('bookings:remind')->expectsOutput('1 rappel(s) envoyé(s).')->assertSuccessful();
        $this->artisan('bookings:remind')->expectsOutput('0 rappel(s) envoyé(s).');
        Notification::assertSentToTimes($this->mariama(), BookingReminder::class, 1);
        $this->assertNotNull(Booking::where('reference', 'RDV-2026-000201')->value('reminder_sent_at'));
    }

    public function test_le_pilote_log_ecrit_le_sms_avec_un_numero_masque(): void
    {
        Log::shouldReceive('channel')->with('sms')->andReturnSelf();
        Log::shouldReceive('info')->once()->withArgs(fn ($msg, $ctx) => $ctx['to'] === '+22177***4567' && str_contains($ctx['text'], 'Dabo Hair'));
        $c = Customer::create(['first_name' => 'Binta', 'last_name' => 'Kane', 'phone' => '77 123 45 67']);
        $c->notifyNow(new BookingReceived(Booking::first()), [SmsChannel::class]);
    }

    public function test_une_panne_d_envoi_ne_bloque_jamais_la_reservation(): void
    {
        $this->app->instance(SmsSender::class, new class implements SmsSender
        {
            public function send(string $to, string $text): void
            {
                throw new RuntimeException('Opérateur SMS indisponible');
            }
        });
        $this->withoutExceptionHandling();
        $this->postJson('/api/v1/bookings', $this->bookingPayload(['first_name' => 'Khady', 'last_name' => 'Fall', 'phone' => '76 111 22 33', 'email' => null]))->assertCreated();
        $this->assertDatabaseHas('bookings', ['service_name' => 'Nattes collées', 'status' => 'pending']);
    }

    public function test_un_pilote_sms_inconnu_est_refuse(): void
    {
        config(['services.sms.driver' => 'inconnu']);
        $this->app->forgetInstance(SmsSender::class);
        $this->expectExceptionMessage('SMS_DRIVER inconnu : inconnu');
        app(SmsSender::class);
    }

    /** Chaque message tient en un SMS (160 caractères au plus, hors lien) et son e-mail s'affiche en français */
    public function test_tous_les_messages_sont_rediges_en_francais(): void
    {
        $booking = Booking::where('reference', 'RDV-2026-000201')->first();
        $booking->cancellation_reason = 'Coiffeuse malade';
        $survey = SatisfactionSurvey::create(['token_hash' => str_repeat('a', 64), 'customer_id' => $this->mariama()->id, 'kind' => 'booking',
            'subject_label' => 'Micro twist', 'sent_at' => now(), 'expires_at' => now()->addDays(14)]);
        $messages = [
            new BookingReceived($booking), new BookingConfirmed($booking), new BookingReminder($booking),
            new BookingCancelledBySalon($booking), new BookingCancelledByCustomer($booking),
            new SatisfactionSurveyRequest($survey, str_repeat('b', 40)),
        ];
        foreach ($messages as $n) {
            $sms = preg_replace('#https?://\S+#', '', $n->toSms($this->mariama())->text);
            $this->assertLessThanOrEqual(160, mb_strlen($sms), $n::class.' : '.$sms);
            $html = (string) $n->toMail($this->mariama())->render();
            $this->assertStringContainsString('Bonjour Mariama', $html);
            $this->assertStringContainsString('L’équipe Dabo Hair', $html);
            $this->assertStringContainsString('Si le bouton', $html); // pied de page traduit
        }
    }
}
