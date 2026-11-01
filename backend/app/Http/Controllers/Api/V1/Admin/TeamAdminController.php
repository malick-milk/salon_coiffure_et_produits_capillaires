<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Spatie\Activitylog\Models\Activity;
use Spatie\Permission\Models\Role;

/** Utilisateurs du personnel, rôles et journal d'audit (EF-ERP-07 à 09) */
class TeamAdminController extends Controller
{
    private const STAFF_ROLES = ['super_admin', 'manager', 'cashier', 'stylist', 'stock_keeper'];

    public function users(): JsonResponse
    {
        $users = User::query()->role(self::STAFF_ROLES)->with('roles')->orderBy('first_name')->get();

        return response()->json(['data' => $users->map(fn (User $u) => $this->userRow($u))]);
    }

    public function roles(): JsonResponse
    {
        return response()->json(['data' => Role::query()->whereIn('name', self::STAFF_ROLES)->with('permissions')->get()
            ->map(fn (Role $r) => ['name' => $r->name, 'permissions' => $r->permissions->pluck('name')->sort()->values()])]);
    }

    public function storeUser(Request $request): JsonResponse
    {
        $data = $request->validate([
            'first_name' => ['required', 'string', 'min:2', 'max:100'],
            'last_name' => ['required', 'string', 'min:2', 'max:100'],
            'email' => ['required', 'email:rfc', 'max:191', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'regex:'.\App\Support\Phone::SENEGAL_MOBILE, 'unique:users,phone'],
            'role' => ['required', Rule::in(self::STAFF_ROLES)],
            'password' => ['required', 'string', 'max:72', Password::min(10)->letters()->numbers()],
        ]);
        $user = User::create([...collect($data)->except('role')->all(), 'email' => Str::lower($data['email'])]);
        $user->assignRole($data['role']);
        activity('users')->performedOn($user)->causedBy($request->user())->withProperties(['role' => $data['role']])->event('created')->log('staff created');

        return response()->json(['data' => $this->userRow($user)], 201);
    }

    public function updateUser(Request $request, User $user): JsonResponse
    {
        $data = $request->validate(['role' => ['sometimes', Rule::in(self::STAFF_ROLES)], 'is_active' => ['sometimes', 'boolean']]);

        // Garde-fou : on ne peut pas se retirer à soi-même ses droits d'administration (risque de blocage)
        if ($user->is($request->user()) && ((isset($data['role']) && $data['role'] !== 'super_admin') || ($data['is_active'] ?? true) === false)) {
            abort(422, 'Vous ne pouvez pas retirer vos propres droits d’administration.');
        }

        if (isset($data['role'])) {
            $old = $user->getRoleNames()->implode(',');
            $user->syncRoles([$data['role']]);
            activity('users')->performedOn($user)->causedBy($request->user())->withProperties(['old' => ['role' => $old], 'attributes' => ['role' => $data['role']]])->event('role_changed')->log('role changed');
        }
        if (array_key_exists('is_active', $data)) {
            $user->update(['is_active' => $data['is_active']]);
        }

        return response()->json(['data' => $this->userRow($user->fresh('roles'))]);
    }

    public function audit(Request $request): JsonResponse
    {
        $request->validate(['page' => ['nullable', 'integer', 'min:1'], 'log' => ['nullable', 'string', 'max:30']]);
        $page = Activity::query()->with('causer')->when($request->input('log'), fn ($q, $l) => $q->where('log_name', $l))->latest('id')->paginate(30);

        return response()->json([
            'data' => $page->getCollection()->map(fn (Activity $a) => [
                'id' => $a->id, 'log' => $a->log_name, 'event' => $a->event, 'description' => $a->description,
                'subject' => $a->subject_type ? class_basename($a->subject_type).' #'.$a->subject_id : null,
                'causer' => $a->causer ? trim($a->causer->first_name.' '.$a->causer->last_name) : 'Système',
                'changes' => $a->properties, 'created_at' => $a->created_at?->format('Y-m-d\TH:i:s'),
            ]),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
        ]);
    }

    private function userRow(User $u): array
    {
        return ['id' => $u->id, 'first_name' => $u->first_name, 'last_name' => $u->last_name, 'email' => $u->email, 'phone' => $u->phone,
            'role' => $u->getRoleNames()->first(), 'is_active' => $u->is_active, 'last_login_at' => $u->last_login_at?->format('Y-m-d\TH:i:s')];
    }
}
