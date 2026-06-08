export const formatCurrency = (amount: number, currency = 'EUR'): string => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
  }).format(amount)
}

export const formatDate = (date: Date | string): string => {
  const d = new Date(date)
  return d.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export const round = (val: number): number => {
  return Math.round(val * 100) / 100
}

// Local calculations for UX preview (actual values come from backend)
export const calculateLineTotal = (quantity: number, unitPrice: number, vat: number, withholding: number): number => {
  const subtotal = round(quantity * unitPrice)
  const vatAmount = round(subtotal * vat / 100)
  const withholdingAmount = round(subtotal * withholding / 100)
  return round(subtotal + vatAmount - withholdingAmount)
}
