<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeeDocument;
use App\Models\EmploymentContract;
use App\Models\Setting;
use App\Models\Stylist;
use App\Models\User;
use App\Services\Hr\ContractRules;
use App\Support\Phone;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Spatie\Activitylog\Models\Activity;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * CONTRATS ET RH (maquette validée le 26 novembre 2026). Route protégée par la permission hr.manage,
 * donnée à la PROPRIÉTAIRE seulement : salaires et pièces d'identité sont confidentiels.
 * Règles légales (durées, renouvellement, alertes) : App\Services\Hr\ContractRules.
 */
class HrAdminController extends Controller
{
    private const DISK = 'local'; // storage/app/private : jamais servi par le site public

    /** Liste « L'équipe » : contrats en cours, alertes en haut, contrats terminés à part, masse salariale du mois */
    public function index(): JsonResponse
    {
        $employees = Employee::query()->with(['currentContract', 'contracts'])->orderBy('first_name')->get();
        $current = $employees->filter(fn (Employee $e) => $this->current($e) !== null);
        $month = now();

        $alerts = $current->flatMap(fn (Employee $e) => collect(ContractRules::alerts($this->withEmployee($this->current($e), $e)))
            ->map(fn ($a) => $a + ['employee_id' => $e->id]))->sortBy(fn ($a) => [$a['level'] === 'danger' ? 0 : 1, $a['date'] ?? '9999'])->values();

        $commissions = $current->sum(fn (Employee $e) => ContractRules::commission($this->withEmployee($this->current($e), $e), $month)['commission']);

        return response()->json([
            'data' => $current->map(fn (Employee $e) => $this->listRow($e, $this->current($e)))->values(),
            'ended' => $employees->filter(fn (Employee $e) => $this->current($e) === null && $this->latest($e) !== null)
                ->map(fn (Employee $e) => $this->listRow($e, $this->latest($e)))->values(),
            'alerts' => $alerts,
            'payroll' => ['month' => $month->format('Y-m'), 'base_total' => (int) $current->sum(fn (Employee $e) => $this->current($e)->base_salary ?? 0), 'commissions' => $commissions],
        ]);
    }

    public function show(Employee $employee): JsonResponse
    {
        return response()->json(['data' => $this->sheet($employee), 'options' => $this->options()]);
    }

    /** « + Nouveau contrat » : la personne et son contrat en une fois */
    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request, null);
        $this->checkTerms($data);
        $employee = DB::transaction(function () use ($data, $request) {
            $employee = Employee::create(collect($data)->only($this->employeeFields())->all());
            $employee->contracts()->create([...collect($data)->only($this->contractFields())->all(), 'created_by' => $request->user()->id]);

            return $employee;
        });

        return response()->json(['data' => $this->sheet($employee->fresh())], 201);
    }

    /** « Enregistrer » sur la fiche : la personne et son contrat en cours */
    public function update(Request $request, Employee $employee): JsonResponse
    {
        $contract = $this->current($employee);
        $data = $this->validated($request, $employee);
        $contractData = collect($data)->only($this->contractFields())->all();
        if ($contract && $contractData) {
            if (isset($contractData['type']) && $contractData['type'] !== $contract->type && $contract->renewal_count > 0) {
                throw ValidationException::withMessages(['type' => 'Ce CDD a été renouvelé : pour changer de contrat, utilisez « Passer en CDI ».']);
            }
            $this->checkTerms([...$contract->only(['type', 'starts_on', 'ends_on', 'trial_ends_on']), ...$contractData]);
        }
        DB::transaction(function () use ($employee, $contract, $data, $contractData) {
            $employee->update(collect($data)->only($this->employeeFields())->all());
            if ($contract && $contractData) {
                $contract->update($contractData);
            }
        });

        return response()->json(['data' => $this->sheet($employee->fresh())]);
    }

    /** « Renouveler le CDD (1 fois) » : nouvelle date de fin, dans les limites de la loi */
    public function renew(Request $request, EmploymentContract $contract): JsonResponse
    {
        $data = $request->validate(['ends_on' => ['required', 'date_format:Y-m-d']]);
        $refusal = ContractRules::renewalRefusal($contract, Carbon::parse($data['ends_on']));
        if ($refusal) {
            throw ValidationException::withMessages(['ends_on' => $refusal]);
        }
        $contract->update(['ends_on' => $data['ends_on'], 'renewal_count' => $contract->renewal_count + 1]);

        return response()->json(['data' => $this->sheet($contract->employee)]);
    }

    /** « Passer en CDI » : le contrat actuel se termine, un CDI commence le lendemain avec les mêmes conditions */
    public function convert(Request $request, EmploymentContract $contract): JsonResponse
    {
        $data = $request->validate(['starts_on' => ['required', 'date_format:Y-m-d']]);
        if ($contract->ended_on || $contract->type === 'cdi') {
            throw ValidationException::withMessages(['contract' => 'Ce contrat est déjà un CDI ou il est terminé.']);
        }
        $start = Carbon::parse($data['starts_on']);
        if ($start->lt($contract->starts_on)) {
            throw ValidationException::withMessages(['starts_on' => 'Le CDI commence après le début du contrat actuel.']);
        }
        DB::transaction(function () use ($contract, $start, $request) {
            $contract->update(['ended_on' => $start->copy()->subDay()->max($contract->starts_on), 'end_reason' => 'converted']);
            $contract->employee->contracts()->create([
                ...$contract->only(['position', 'weekly_hours', 'work_days', 'base_salary', 'commission_rate', 'pay_method']),
                'type' => 'cdi', 'starts_on' => $start, 'previous_contract_id' => $contract->id, 'created_by' => $request->user()->id,
            ]);
        });

        return response()->json(['data' => $this->sheet($contract->employee->fresh())]);
    }

    /** « Terminer le contrat » : date de fin réelle et motif ; le dossier reste consultable dans « contrats terminés » */
    public function terminate(Request $request, EmploymentContract $contract): JsonResponse
    {
        $data = $request->validate([
            'ended_on' => ['required', 'date_format:Y-m-d'],
            'end_reason' => ['required', Rule::in(['end_of_term', 'resigned', 'dismissed', 'trial', 'other'])],
            'end_note' => ['nullable', 'string', 'max:191'],
        ]);
        if ($contract->ended_on) {
            throw ValidationException::withMessages(['contract' => 'Ce contrat est déjà terminé.']);
        }
        if (Carbon::parse($data['ended_on'])->lt($contract->starts_on)) {
            throw ValidationException::withMessages(['ended_on' => 'La fin doit suivre le début du contrat.']);
        }
        $contract->update($data);

        return response()->json(['data' => $this->sheet($contract->employee)]);
    }

    public function storeDocument(Request $request, Employee $employee): JsonResponse
    {
        $data = $request->validate([
            'document' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
            'kind' => ['required', Rule::in(['contract', 'id_card', 'other'])],
        ], ['document.max' => 'Le fichier dépasse 5 Mo.', 'document.mimes' => 'Formats acceptés : PDF, JPG ou PNG.']);
        $file = $request->file('document');
        $path = $file->storeAs('hr/'.$employee->id, Str::random(32).'.'.$file->extension(), self::DISK);
        $contract = $this->current($employee);
        $employee->documents()->create([
            'employment_contract_id' => $contract?->id, 'kind' => $data['kind'], 'original_name' => Str::limit($file->getClientOriginalName(), 180, ''),
            'path' => $path, 'mime' => (string) $file->getMimeType(), 'size' => (int) $file->getSize(), 'uploaded_by' => $request->user()->id,
        ]);
        // Le contrat signé est enregistré : le contrat est signé (l'alerte « Contrat non signé » disparaît)
        if ($data['kind'] === 'contract' && $contract && ! $contract->signed_on) {
            $contract->update(['signed_on' => now()->toDateString()]);
        }
        activity('hr')->performedOn($employee)->causedBy($request->user())->withProperties(['kind' => $data['kind']])->event('document_added')->log('document added');

        return response()->json(['data' => $this->sheet($employee->fresh())], 201);
    }

    public function downloadDocument(EmployeeDocument $document): StreamedResponse
    {
        abort_unless(Storage::disk(self::DISK)->exists($document->path), 404);

        return Storage::disk(self::DISK)->download($document->path, $document->original_name, ['Cache-Control' => 'private, no-store']);
    }

    public function destroyDocument(Request $request, EmployeeDocument $document): JsonResponse
    {
        $employee = $document->employee;
        Storage::disk(self::DISK)->delete($document->path);
        $document->delete();
        activity('hr')->performedOn($employee)->causedBy($request->user())->withProperties(['kind' => $document->kind])->event('document_removed')->log('document removed');

        return response()->json(['data' => $this->sheet($employee->fresh())]);
    }

    public function storeLeave(Request $request, Employee $employee): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', Rule::in(['paid', 'maternity', 'sick', 'other'])],
            'starts_on' => ['required', 'date_format:Y-m-d'],
            'ends_on' => ['required', 'date_format:Y-m-d', 'after_or_equal:starts_on'],
            'days' => ['required', 'numeric', 'min:0.5', 'max:200'],
            'note' => ['nullable', 'string', 'max:191'],
        ]);
        $employee->leaves()->create($data);
        activity('hr')->performedOn($employee)->causedBy($request->user())->withProperties($data)->event('leave_added')->log('leave added');

        return response()->json(['data' => $this->sheet($employee->fresh())], 201);
    }

    /** « Imprimer le contrat » : un modèle rempli, à faire relire puis signer en deux exemplaires */
    public function pdf(EmploymentContract $contract): Response
    {
        return Pdf::loadView('pdf.employment-contract', ['contract' => $contract, 'employee' => $contract->employee, 'company' => Setting::get('company.identity', []) ?? [],
            'rules' => ['cdd_months' => ContractRules::CDD_MAX_MONTHS, 'indemnity' => ContractRules::END_OF_CDD_INDEMNITY_PERCENT, 'leave' => ContractRules::LEAVE_DAYS_PER_MONTH]])
            ->setPaper('a4')->stream('contrat-'.Str::slug($contract->employee->fullName()).'.pdf');
    }

    // ---------------------------------------------------------------------------------------------------------

    /** @return array<string, mixed> */
    private function validated(Request $request, ?Employee $employee): array
    {
        $req = $employee ? 'sometimes' : 'required';
        if ($request->filled('phone')) {
            $request->merge(['phone' => Phone::normalize($request->input('phone'))]); // « 77 123 45 67 » → « 771234567 »
        }

        return $request->validate([
            'first_name' => [$req, 'string', 'min:2', 'max:100'],
            'last_name' => [$req, 'string', 'min:2', 'max:100'],
            'phone' => ['nullable', 'string', 'regex:'.Phone::SENEGAL_MOBILE],
            'birth_date' => ['nullable', 'date_format:Y-m-d', 'before:today'],
            'address' => ['nullable', 'string', 'max:191'],
            'id_number' => ['nullable', 'string', 'max:30'],
            'ipres_number' => ['nullable', 'string', 'max:30'],
            'css_number' => ['nullable', 'string', 'max:30'],
            'user_id' => ['nullable', 'integer', Rule::exists('users', 'id')],
            'stylist_id' => ['nullable', 'integer', Rule::exists('stylists', 'id')],
            'type' => [$req, Rule::in(EmploymentContract::TYPES)],
            'position' => [$req, 'string', 'min:2', 'max:100'],
            'starts_on' => [$req, 'date_format:Y-m-d'],
            'ends_on' => ['nullable', 'date_format:Y-m-d'],
            'trial_ends_on' => ['nullable', 'date_format:Y-m-d'],
            'weekly_hours' => ['nullable', 'integer', 'min:1', 'max:60'],
            'work_days' => ['nullable', 'string', 'max:60'],
            'base_salary' => ['nullable', 'integer', 'min:0', 'max:10000000'],
            'commission_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'pay_method' => ['nullable', Rule::in(EmploymentContract::PAY_METHODS)],
            'signed_on' => ['nullable', 'date_format:Y-m-d'],
        ]);
    }

    /** @param array<string, mixed> $data */
    private function checkTerms(array $data): void
    {
        $date = fn ($v) => $v ? Carbon::parse($v) : null;
        $errors = ContractRules::termErrors($data['type'], Carbon::parse($data['starts_on']), $date($data['ends_on'] ?? null), $date($data['trial_ends_on'] ?? null));
        if ($errors) {
            throw ValidationException::withMessages($errors);
        }
    }

    /** @return list<string> */
    private function employeeFields(): array
    {
        return ['first_name', 'last_name', 'phone', 'birth_date', 'address', 'id_number', 'ipres_number', 'css_number', 'user_id', 'stylist_id'];
    }

    /** @return list<string> */
    private function contractFields(): array
    {
        return ['type', 'position', 'starts_on', 'ends_on', 'trial_ends_on', 'weekly_hours', 'work_days', 'base_salary', 'commission_rate', 'pay_method', 'signed_on'];
    }

    /** Le contrat en cours, typé (la relation latestOfMany est vue comme un Model générique par l'analyse statique) */
    private function current(Employee $e): ?EmploymentContract
    {
        $c = $e->currentContract;

        return $c instanceof EmploymentContract ? $c : null;
    }

    /** Le contrat en cours, sinon le plus récent */
    private function latest(Employee $e): ?EmploymentContract
    {
        $c = $this->current($e) ?? $e->contracts->sortByDesc('starts_on')->first();

        return $c instanceof EmploymentContract ? $c : null;
    }

    /** Évite de recharger la personne pour chaque contrat de la liste */
    private function withEmployee(?EmploymentContract $c, Employee $e): EmploymentContract
    {
        if ($c === null) {
            throw new \LogicException('Contrat attendu.');
        }

        return $c->setRelation('employee', $e);
    }

    private function listRow(Employee $e, ?EmploymentContract $c): array
    {
        if ($c === null) {
            throw new \LogicException('Contrat attendu.');
        }

        $alerts = ContractRules::alerts($this->withEmployee($c, $e));
        $kinds = array_column($alerts, 'kind');
        $state = match (true) {
            (bool) $c->ended_on => 'ended',
            in_array('overdue', $kinds, true) => 'overdue',
            in_array('unsigned', $kinds, true) => 'unsigned',
            in_array('ending', $kinds, true) => 'ending',
            $c->trial_ends_on && $c->trial_ends_on->gte(today()) => 'trial',
            default => 'active',
        };

        return ['id' => $e->id, 'name' => $e->fullName(), 'position' => $c->position, 'type' => $c->type, 'starts_on' => $c->starts_on->toDateString(),
            'ends_on' => ($c->ended_on ?? $c->ends_on)?->toDateString(), 'base_salary' => $c->base_salary, 'commission_rate' => (float) $c->commission_rate, 'state' => $state];
    }

    private function sheet(Employee $e): array
    {
        $e->loadMissing(['contracts', 'documents', 'leaves']);
        $c = $this->latest($e);
        $contractIds = $e->contracts->pluck('id');
        $history = Activity::query()->with('causer')->where('log_name', 'hr')
            ->where(fn ($q) => $q->where(fn ($q) => $q->where('subject_type', $e->getMorphClass())->where('subject_id', $e->id))
                ->orWhere(fn ($q) => $q->where('subject_type', (new EmploymentContract)->getMorphClass())->whereIn('subject_id', $contractIds)))
            ->latest('id')->limit(8)->get();

        return [
            'id' => $e->id,
            'employee' => [...$e->only(['first_name', 'last_name', 'phone', 'address', 'id_number', 'ipres_number', 'css_number', 'user_id', 'stylist_id']),
                'birth_date' => $e->birth_date?->toDateString(), 'name' => $e->fullName()],
            'contract' => $c ? $this->contractRow($c->setRelation('employee', $e)) : null,
            'contracts' => $e->contracts->sortByDesc('starts_on')->values()->map(fn (EmploymentContract $x) => [
                'id' => $x->id, 'type' => $x->type, 'starts_on' => $x->starts_on->toDateString(), 'ended_on' => $x->ended_on?->toDateString(), 'end_reason' => $x->end_reason]),
            'documents' => $e->documents->sortByDesc('id')->values()->map(fn (EmployeeDocument $d) => [
                'id' => $d->id, 'kind' => $d->kind, 'name' => $d->original_name, 'size' => $d->size, 'created_at' => $d->created_at?->toDateString()]),
            'leaves' => $e->leaves->sortByDesc('starts_on')->values()->map(fn ($l) => [
                'id' => $l->id, 'kind' => $l->kind, 'starts_on' => $l->starts_on->toDateString(), 'ends_on' => $l->ends_on->toDateString(), 'days' => (float) $l->days, 'note' => $l->note]),
            'leave_balance' => $c ? ContractRules::leaveBalance($e, $c) : null,
            'history' => $history->map(fn (Activity $a) => ['event' => $a->event, 'subject' => $a->subject_type === $e->getMorphClass() ? 'employee' : 'contract', 'changes' => $a->properties, 'created_at' => Carbon::make($a->created_at)?->format('Y-m-d\TH:i:s'),
                'causer' => $a->causer instanceof User ? trim($a->causer->first_name.' '.$a->causer->last_name) : 'Système']),
        ];
    }

    private function contractRow(EmploymentContract $c): array
    {
        $canRenew = $c->type === 'cdd' && ! $c->ended_on && $c->renewal_count < ContractRules::CDD_MAX_RENEWALS;

        return [
            ...$c->only(['id', 'type', 'position', 'weekly_hours', 'work_days', 'base_salary', 'pay_method', 'renewal_count', 'end_reason', 'end_note']),
            'commission_rate' => (float) $c->commission_rate,
            ...collect(['starts_on', 'ends_on', 'trial_ends_on', 'signed_on', 'ended_on'])->mapWithKeys(fn ($k) => [$k => $c->{$k}?->toDateString()])->all(),
            'alerts' => ContractRules::alerts($c),
            'commission' => ContractRules::commission($c, now()),
            'can_renew' => $canRenew,
            // Jusqu'où le renouvellement peut aller (limite de 2 ans par contrat et de 4 ans au total)
            'renew_max' => $canRenew ? $c->starts_on->copy()->addMonths(ContractRules::CDD_MAX_TOTAL_MONTHS)->subMonths((int) ceil(ContractRules::pastCddMonths($c->employee, $c->id)))->toDateString() : null,
            'end_indemnity_estimate' => $c->ends_on ? ContractRules::endOfCddIndemnity($c, $c->ends_on) : null,
        ];
    }

    /** Comptes de l'ERP et fiches du planning, pour relier la fiche (facultatif) */
    private function options(): array
    {
        return [
            'users' => User::query()->role(['super_admin', 'manager', 'cashier', 'stylist', 'stock_keeper'])->orderBy('first_name')->get()
                ->map(fn (User $u) => ['id' => $u->id, 'name' => trim($u->first_name.' '.$u->last_name)]),
            'stylists' => Stylist::query()->orderBy('display_name')->get()->map(fn (Stylist $s) => ['id' => $s->id, 'name' => $s->display_name]),
        ];
    }
}
