import { describe, it, expect } from 'vitest';

// ── Pure utility functions extracted for testing ──────────────────────────

function shortAddr(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function validateStellarAddress(addr: string): boolean {
  return addr.startsWith('G') && addr.length >= 56;
}

function calculateFee(amount: number): { fee: number; sellerAmount: number } {
  const fee = amount / 100;
  return { fee, sellerAmount: amount - fee };
}

function formatEscrowStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('shortAddr', () => {
  it('truncates a long address', () => {
    const addr = 'GBZB7Y3BFHUJKMBYJBNIGF7QLKDAHZQE2WUJRLQ6X5ZEXAMPLELONG1234';
    const result = shortAddr(addr);
    expect(result).toBe('GBZB7Y...1234');
  });

  it('returns short strings unchanged', () => {
    expect(shortAddr('GTEST')).toBe('GTEST');
  });

  it('handles exactly 12 character address', () => {
    const addr = 'GABCDEFGHIJK'; // 12 chars
    expect(shortAddr(addr)).toContain('...');
  });
});

describe('validateStellarAddress', () => {
  it('accepts valid-looking Stellar address', () => {
    const addr = 'GBZB7Y3BFHUJKMBYJBNIGF7QLKDAHZQE2WUJRLQ6X5ZEXAMPLELONG1234';
    expect(validateStellarAddress(addr)).toBe(true);
  });

  it('rejects address not starting with G', () => {
    expect(validateStellarAddress('ABCD7Y3BFHUJKMBYJBNIGF7QLKDAHZQE2WUJRLQ6X5Z1234')).toBe(false);
  });

  it('rejects address too short', () => {
    expect(validateStellarAddress('GABCDE')).toBe(false);
  });
});

describe('calculateFee', () => {
  it('calculates 1% fee correctly', () => {
    const { fee, sellerAmount } = calculateFee(100);
    expect(fee).toBe(1);
    expect(sellerAmount).toBe(99);
  });

  it('fee + sellerAmount equals original amount', () => {
    const amount = 250;
    const { fee, sellerAmount } = calculateFee(amount);
    expect(fee + sellerAmount).toBe(amount);
  });

  it('handles zero amount', () => {
    const { fee, sellerAmount } = calculateFee(0);
    expect(fee).toBe(0);
    expect(sellerAmount).toBe(0);
  });

  it('handles large amounts', () => {
    const { fee } = calculateFee(10000);
    expect(fee).toBe(100);
  });
});

describe('formatEscrowStatus', () => {
  it('formats "FUNDED" to "Funded"', () => {
    expect(formatEscrowStatus('FUNDED')).toBe('Funded');
  });

  it('formats "created" to "Created"', () => {
    expect(formatEscrowStatus('created')).toBe('Created');
  });

  it('formats "COMPLETED" to "Completed"', () => {
    expect(formatEscrowStatus('COMPLETED')).toBe('Completed');
  });
});

describe('escrow state machine transitions', () => {
  type Status = 'Created' | 'Funded' | 'Shipped' | 'Completed' | 'Disputed';

  const validTransitions: Record<Status, Status | null> = {
    Created: 'Funded',
    Funded: 'Shipped',
    Shipped: 'Completed',
    Completed: null,
    Disputed: null,
  };

  it('Created can transition to Funded', () => {
    expect(validTransitions['Created']).toBe('Funded');
  });

  it('Funded can transition to Shipped', () => {
    expect(validTransitions['Funded']).toBe('Shipped');
  });

  it('Shipped can transition to Completed', () => {
    expect(validTransitions['Shipped']).toBe('Completed');
  });

  it('Completed has no further transitions', () => {
    expect(validTransitions['Completed']).toBeNull();
  });

  it('Disputed has no further transitions', () => {
    expect(validTransitions['Disputed']).toBeNull();
  });
});
