import { describe, it, expect } from 'vitest';
import { validateContent } from '@/content/validate';

describe('validateContent (docs/10)', () => {
  it('der ausgelieferte Content ist valide (keine Fehler)', () => {
    const errors = validateContent();
    expect(errors).toEqual([]);
  });
});
