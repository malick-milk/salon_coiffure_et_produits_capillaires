<?php

namespace App\Console\Commands;

use App\Models\Booking;
use App\Notifications\BookingReminder;
use App\Support\Notify;
use Illuminate\Console\Command;

/** Chaque fin d'après-midi : rappel des rendez-vous du lendemain, une seule fois par rendez-vous (étape 13) */
class SendBookingRemindersCommand extends Command
{
    protected $signature = 'bookings:remind';

    protected $description = 'Envoie le rappel (SMS + e-mail) des rendez-vous de demain';

    public function handle(): int
    {
        $tomorrow = now()->addDay();
        $bookings = Booking::query()->active()->with('customer')->whereNull('reminder_sent_at')
            ->whereBetween('starts_at', [$tomorrow->copy()->startOfDay(), $tomorrow->copy()->endOfDay()])->get();

        foreach ($bookings as $booking) {
            Notify::customer($booking->customer, new BookingReminder($booking));
            $booking->forceFill(['reminder_sent_at' => now()])->saveQuietly(); // saveQuietly : pas d'entrée d'audit inutile
        }
        $this->info($bookings->count().' rappel(s) envoyé(s).');

        return self::SUCCESS;
    }
}
