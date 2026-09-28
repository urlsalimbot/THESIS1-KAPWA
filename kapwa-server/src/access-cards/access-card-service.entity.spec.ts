import { getMetadataArgsStorage } from 'typeorm';
import { AccessCardService } from './access-card-service.entity';

// `cost` is DECIMAL(12,2). node-postgres hands decimals back as strings — it
// will not round-trip them through a JS float without being asked. So the
// column's TypeScript type (`number`) and the value it actually holds
// disagreed, and every consumer had to remember to coerce. The printable
// access card is the one that forgot: it renders `₱${s.cost.toLocaleString()}`,
// and `String.prototype.toLocaleString` ignores its arguments, so a real card
// printed "₱5000.00" instead of "₱5,000".
//
// The fix belongs at the column, so no consumer has to know any of this.
describe('AccessCardService.cost', () => {
  const costColumn = () =>
    getMetadataArgsStorage().columns.find(
      c => c.target === AccessCardService && c.propertyName === 'cost',
    );

  it('carries a transformer on the column itself', () => {
    // The regression this guards is deleting `transformer:` from the decorator,
    // which would put every consumer back on raw driver strings while the type
    // still claims `number`. Awaiting it here rather than only testing the
    // transformer function means an unwired transformer fails too.
    expect(costColumn()?.options.transformer).toBeDefined();
  });

  describe('the transformer', () => {
    // Resolved per test so that deleting the decorator's `transformer:` fails
    // with a sentence rather than a TypeError about `undefined.from`.
    const transformer = () => {
      const t = costColumn()?.options.transformer;
      if (!t) throw new Error('AccessCardService.cost is not carrying a transformer');
      return t as { from: (v: unknown) => unknown; to: (v: unknown) => unknown };
    };

    it('reads the exact string node-postgres returns', () => {
      // Verified against a live PG 18 through the real pg driver:
      //   SELECT cost FROM ... -> "5000.00", typeof string
      expect(transformer().from('5000.00')).toBe(5000);
      expect(transformer().from('1500.50')).toBe(1500.5);
      expect(transformer().from('0.00')).toBe(0);
    });

    it('leaves a real number alone', () => {
      expect(transformer().from(5000)).toBe(5000);
    });

    it('passes null and undefined through as absent, not as NaN', () => {
      // NaN would serialize to `null` in JSON anyway, but it would poison any
      // arithmetic in between — a total would come out NaN rather than a sum.
      expect(transformer().from(null)).toBeNull();
      expect(transformer().from(undefined)).toBeNull();
      expect(Number.isNaN(transformer().from(null) as number)).toBe(false);
    });

    it('refuses to turn an unparseable value into a silent zero', () => {
      // `Number('')` is 0 and `Number('abc')` is NaN. Storing a service cost
      // that nobody can read is worse than storing nothing.
      expect(transformer().from('')).toBeNull();
      expect(transformer().from('abc')).toBeNull();
    });

    it('writes a form Postgres will keep at two decimal places', () => {
      // The driver would otherwise stringify the float, and 0.1 + 0.2 style
      // artefacts can reach the column. A fixed-scale string is exact.
      expect(transformer().to(5000)).toBe('5000.00');
      expect(transformer().to(1500.5)).toBe('1500.50');
      expect(transformer().to(null)).toBeNull();
      expect(transformer().to(undefined)).toBeNull();
    });
  });
});
