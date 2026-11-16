<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Models\Booking;
use App\Models\Customer;
use App\Models\Service;
use App\Models\Stylist;
use App\Models\User;
use App\Notifications\BookingConfirmed;
use App\Notifications\ResserrageReminder;
use App\Notifications\SatisfactionSurveyRequest;
use App\Services\Salon\ResserrageReminderService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

/**
 * Rappels de resserrage (maquette validée le 16 novembre 2026) : espace client + e-mail, jamais de SMS.
 * La démo (DemoAccountsSeeder) a déjà envoyé un rappel à Mariama : chaque test crée sa propre cliente.
 */
class ResserrageReminderTest extends TestCase
{
    use RefreshDatabase;

    private function twist(string $slug = 'micro-twist-long', int $daysAgo = 40, ?Customer $customer = null, BookingStatus $status = BookingStatus::Completed): Booking
    {
        static $n = 900;
        $service = Service::where('slug', $slug)->first();
        $customer ??= $this->customer();
        $start = now()->subDays($daysAgo)->setTime(8 + $n % 10, 0); // heures différentes : jamais deux RDV sur le même créneau

        return Booking::create([
            'reference' => 'RDV-2026-'.str_pad((string) $n++, 6, '0', STR_PAD_LEFT), 'customer_id' => $customer->id, 'service_id' => $service->id, 'stylist_id' => Stylist::query()->value('id'),
            'status' => $status, 'starts_at' => $start, 'ends_at' => $start->copy()->addMinutes($service->duration_minutes),
            'service_name' => $service->name, 'duration_minutes' => $service->duration_minutes, 'price' => $service->price,
        ]);
    }

    private function customer(bool $account = true, ?string $email = 'auto'): Customer
    {
        $email = $email === 'auto' ? fake()->unique()->safeEmail() : $email; // une adresse différente par cliente
        $user = $account ? User::factory()->create(['email' => $email ?? fake()->unique()->safeEmail()]) : null;

        return Customer::create(['user_id' => $user?->id, 'first_name' => 'Fatou', 'last_name' => 'Ndiaye', 'phone' => '77'.random_int(1000000, 9999999), 'email' => $email]);
    }

    public function test_rappel_dans_le_profil_et_par_e_mail_jamais_par_sms(): void
    {
        Notification::fake();
        $booking = $this->twist(daysAgo: 30); // délai de démo : 28 jours

        $this->assertSame(['sent' => 1, 'skipped' => 0], app(ResserrageReminderService::class)->run());

        Notification::assertSentTo($booking->customer, ResserrageReminder::class, function (ResserrageReminder $n, array $channels) use ($booking) {
            $data = $n->toArray($booking->customer);

            return $channels === ['database', 'mail']
                && $data['resserrage']['slug'] === 'resserrage-micro-twist' && $data['resserrage']['price'] === 10000
                && $data['url'] === '/reserver?prestation=resserrage-micro-twist'
                && str_starts_with($data['text'], 'Votre micro twist long a été fait le');
        });
        $this->assertNotNull($booking->fresh()->resserrage_reminded_at);
    }

    public function test_pas_avant_le_delai_une_seule_fois_et_rien_sans_delai_fixe_par_awa(): void
    {
        Notification::fake();
        $service = app(ResserrageReminderService::class);
        $booking = $this->twist(daysAgo: 10);
        $this->assertSame(0, $service->run()['sent']);                                   // 10 jours < 28
        $this->assertSame(1, $service->run(CarbonImmutable::today()->addDays(18))['sent']); // 28 jours atteints
        $this->assertSame(0, $service->run(CarbonImmutable::today()->addDays(40))['sent']); // déjà envoyé

        Service::query()->update(['resserrage_after_days' => null]); // production tant qu'Awa n'a pas donné le délai
        $this->twist(daysAgo: 400);
        $this->assertSame(['sent' => 0, 'skipped' => 0], $service->run());
        Notification::assertSentTimes(ResserrageReminder::class, 1);
        $this->assertNotNull($booking->fresh()->resserrage_reminded_at);
    }

    public function test_aucun_rappel_si_resserrage_deja_reserve_desinscrite_ou_injoignable(): void
    {
        Notification::fake();
        $booked = $this->twist(daysAgo: 30);
        $this->twist('resserrage-micro-twist', daysAgo: -3, customer: $booked->customer, status: BookingStatus::Confirmed);
        $optOut = $this->twist(daysAgo: 30, customer: tap($this->customer(email: 'awa@client.test'))->update(['resserrage_opt_out' => true]));
        $this->twist(daysAgo: 30, customer: $this->customer(account: false, email: null));      // ni compte ni e-mail
        $this->twist('brushing', daysAgo: 300);                                                // pas un twist
        $this->twist(daysAgo: 30, status: BookingStatus::Cancelled, customer: $this->customer(email: 'k@client.test'));

        $this->assertSame(['sent' => 0, 'skipped' => 3], app(ResserrageReminderService::class)->run());
        Notification::assertNothingSent();
        $this->assertNotNull($optOut->fresh()->resserrage_reminded_at); // examiné une fois, plus jamais ensuite
    }

    public function test_sans_compte_mais_avec_e_mail_le_rappel_part_par_e_mail_seulement(): void
    {
        Notification::fake();
        $booking = $this->twist(daysAgo: 30, customer: $this->customer(account: false, email: 'invitee@client.test'));
        app(ResserrageReminderService::class)->run();
        Notification::assertSentTo($booking->customer, ResserrageReminder::class, fn ($n, array $channels) => $channels === ['mail']);
    }

    public function test_profil_lecture_report_d_une_semaine_une_seule_fois(): void
    {
        $booking = $this->twist(daysAgo: 30);
        $this->actingAs($booking->customer->user);
        app(ResserrageReminderService::class)->run(); // file « sync » en test : notification enregistrée tout de suite

        $list = $this->getJson('/api/v1/me/notifications')->assertOk()->assertJsonPath('meta.unread', 1);
        $item = $list->json('data.0');
        $this->assertSame(['resserrage', false, 'Resserrage micro twist'], [$item['kind'], $item['read'], $item['resserrage']['name']]);

        $this->postJson("/api/v1/me/notifications/{$item['id']}/snooze")->assertOk()->assertJsonPath('meta.unread', 0);
        $this->getJson('/api/v1/me/notifications')->assertJsonCount(0, 'data');
        $this->assertNull($booking->fresh()->resserrage_reminded_at);

        $service = app(ResserrageReminderService::class);
        $this->assertSame(0, $service->run(CarbonImmutable::today()->addDays(6))['sent']); // pas avant 7 jours
        $this->assertSame(1, $service->run(CarbonImmutable::today()->addDays(7))['sent']);
        $again = $this->getJson('/api/v1/me/notifications')->json('data.0.id');
        $this->postJson("/api/v1/me/notifications/{$again}/snooze")->assertStatus(422); // un seul report

        $this->postJson('/api/v1/me/notifications/read')->assertOk();
        $this->getJson('/api/v1/me/notifications')->assertJsonPath('meta.unread', 0)->assertJsonPath('data.0.read', true);
    }

    public function test_impossible_de_reporter_la_notification_d_une_autre_cliente(): void
    {
        $other = $this->twist(daysAgo: 30);
        app(ResserrageReminderService::class)->run();
        $id = $other->customer->notifications()->value('id');

        $this->actingAs(User::where('email', 'mariama@client.test')->first());
        $this->postJson("/api/v1/me/notifications/{$id}/snooze")->assertNotFound();
        $this->getJson('/api/v1/me/notifications')->assertOk()->assertJsonMissing(['id' => $id]);
        $this->postJson("/api/v1/me/notifications/{$id}/snooze")->assertNotFound();
        $this->assertNotNull($other->fresh()->resserrage_reminded_at);
    }

    public function test_desinscription_par_lien_signe_et_lien_falsifie_refuse(): void
    {
        $customer = $this->customer();
        $url = URL::signedRoute('reminders.unsubscribe', ['customer' => $customer->id], absolute: false);

        // Même signature, mais le numéro d'une AUTRE cliente existante : refusé
        $mariama = Customer::where('phone', '770000003')->value('id');
        $this->postJson(preg_replace('#/unsubscribe/\d+#', "/unsubscribe/{$mariama}", $url))->assertForbidden();
        $this->assertFalse(Customer::find($mariama)->resserrage_opt_out);
        $this->postJson($url)->assertOk()->assertJsonPath('message', 'Vous ne recevrez plus de rappels de resserrage.');
        $this->assertTrue($customer->fresh()->resserrage_opt_out);
    }

    public function test_l_e_mail_contient_le_bouton_de_reservation_et_le_lien_de_desinscription(): void
    {
        $booking = $this->twist(daysAgo: 30);
        $mail = (new ResserrageReminder($booking, Service::where('slug', 'resserrage-micro-twist')->first(), 28))->toMail($booking->customer);
        $html = (string) $mail->render();

        $this->assertStringContainsString('Fatou, votre resserrage approche', $mail->subject);
        $this->assertStringContainsString('/reserver?prestation=resserrage-micro-twist', $html);
        $this->assertMatchesRegularExpression('#/rappels/desinscription/'.$booking->customer_id.'\?signature=[a-f0-9]{64}#', $html);
        $this->assertStringContainsString('/brand/logo-email.png', $html); // en-tête aux couleurs de la boutique
    }

    public function test_les_autres_messages_arrivent_aussi_dans_le_profil_sans_le_secret_de_l_enquete(): void
    {
        $booking = $this->twist(daysAgo: -2, status: BookingStatus::Confirmed);
        $customer = $booking->customer;
        $this->assertContains('database', (new BookingConfirmed($booking))->via($customer));
        $this->assertSame(['title' => 'Rendez-vous confirmé', 'url' => '/compte/reservations'], array_intersect_key((new BookingConfirmed($booking))->toArray($customer), ['title' => 1, 'url' => 1]));

        $guest = $this->customer(account: false, email: 'g@client.test');
        $this->assertNotContains('database', (new BookingConfirmed($booking))->via($guest)); // pas de compte : pas de profil

        $request = (new \ReflectionClass(SatisfactionSurveyRequest::class))->newInstanceWithoutConstructor();
        $request->token = str_repeat('a', 40);
        $survey = $request->toArray($customer);
        $this->assertStringNotContainsString(str_repeat('a', 40), json_encode($survey));
    }

    public function test_l_api_des_prestations_signale_celles_qui_ont_un_rappel(): void
    {
        $services = collect($this->getJson('/api/v1/services')->assertOk()->json('data'))->keyBy('slug');
        $this->assertTrue($services['micro-twist-long']['resserrage_reminder']);
        $this->assertFalse($services['brushing']['resserrage_reminder']);
    }

    public function test_la_commande_planifiee_chaque_matin(): void
    {
        Notification::fake();
        $this->twist(daysAgo: 30);
        $this->artisan('bookings:resserrage')->expectsOutputToContain('1 rappel(s) de resserrage envoyé(s)')->assertSuccessful();
        $this->artisan('bookings:resserrage')->expectsOutputToContain('0 rappel(s) de resserrage envoyé(s)')->assertSuccessful();
    }
}
