import { Badge } from '@/components/ui/badge'
import type { BookingStatus, OrderStatus, PaymentStatus } from '@/types/api'

type Tone = 'warning' | 'info' | 'success' | 'neutral' | 'gold'

/** Libellés français des statuts : la couleur ne suffit jamais, le texte est toujours affiché */
const ORDER: Record<OrderStatus, [string, Tone]> = {
  pending: ['En attente', 'warning'],
  confirmed: ['Confirmée', 'info'],
  preparing: ['En préparation', 'info'],
  ready: ['Prête à retirer', 'success'],
  shipped: ['En livraison', 'info'],
  delivered: ['Livrée', 'success'],
  cancelled: ['Annulée', 'neutral'],
}
const BOOKING: Record<BookingStatus, [string, Tone]> = {
  pending: ['En attente de confirmation', 'warning'],
  confirmed: ['Confirmée', 'info'],
  completed: ['Terminée', 'success'],
  cancelled: ['Annulée', 'neutral'],
  no_show: ['Absent', 'neutral'],
}
const PAYMENT: Record<PaymentStatus, [string, Tone]> = {
  unpaid: ['À payer à la réception', 'warning'],
  paid: ['Payée', 'success'],
  refunded: ['Remboursée', 'neutral'],
}

export function StatusBadge({ kind, status }: { kind: 'order' | 'booking' | 'payment'; status: string }) {
  const map = (kind === 'order' ? ORDER : kind === 'booking' ? BOOKING : PAYMENT) as Record<string, [string, Tone]>
  const [label, tone] = map[status] ?? [status, 'neutral']
  return <Badge tone={tone}>{label}</Badge>
}
