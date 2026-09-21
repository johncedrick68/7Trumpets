import { saveOptionValue, saveProductOption, setVariantOptionValue } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type OptionValue = { id: string; value: string; position: number };
type ProductOption = { id: string; name: string; position: number; product_option_values: OptionValue[] };
type Variant = {
  id: string;
  sku: string;
  name: string | null;
  variant_option_values: Array<{ option_id: string; option_value_id: string }>;
};

export function ProductOptionsPanel({
  productId,
  options,
  variants,
}: {
  productId: string;
  options: ProductOption[];
  variants: Variant[];
}) {
  return (
    <section className="space-y-4 rounded-lg border bg-background p-4" aria-labelledby={`options-${productId}`}>
      <div>
        <h3 id={`options-${productId}`} className="text-sm font-semibold">Variants &amp; sizes</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Create one canonical option such as Size, add its values, then map each SKU.</p>
      </div>

      <form action={saveProductOption} className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input type="hidden" name="product_id" value={productId} />
        <input type="hidden" name="position" value={options.length} />
        <div className="space-y-1.5">
          <Label htmlFor={`option-name-${productId}`}>New option</Label>
          <Input id={`option-name-${productId}`} name="name" required placeholder="Size" />
        </div>
        <Button type="submit" variant="secondary" className="self-end">Add option</Button>
      </form>

      {options.sort((a, b) => a.position - b.position).map((option) => (
        <div key={option.id} className="space-y-3 rounded-md bg-muted/35 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">{option.name}</p>
            <form action={saveOptionValue} className="flex flex-1 gap-2 sm:max-w-sm">
              <input type="hidden" name="product_id" value={productId} />
              <input type="hidden" name="option_id" value={option.id} />
              <input type="hidden" name="position" value={option.product_option_values.length} />
              <Input name="value" required aria-label={`New ${option.name} value`} placeholder="S, M, L…" className="h-10" />
              <Button type="submit" variant="outline" className="h-10">Add</Button>
            </form>
          </div>

          {option.product_option_values.length === 0 ? (
            <p className="text-xs text-muted-foreground">No values yet. Add the available {option.name.toLowerCase()} choices.</p>
          ) : (
            <div className="space-y-2">
              {variants.map((variant) => {
                const assigned = variant.variant_option_values.find((item) => item.option_id === option.id)?.option_value_id;
                return (
                  <form key={variant.id} action={setVariantOptionValue} className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,11rem)_auto]">
                    <input type="hidden" name="product_id" value={productId} />
                    <input type="hidden" name="variant_id" value={variant.id} />
                    <input type="hidden" name="option_id" value={option.id} />
                    <Label htmlFor={`mapping-${variant.id}-${option.id}`} className="min-w-0 truncate font-mono text-xs">{variant.sku}</Label>
                    <select id={`mapping-${variant.id}-${option.id}`} name="option_value_id" required defaultValue={assigned ?? ""} className="h-11 rounded-md border border-input bg-background px-3 text-sm">
                      <option value="" disabled>Select {option.name.toLowerCase()}</option>
                      {option.product_option_values.sort((a, b) => a.position - b.position).map((value) => <option key={value.id} value={value.id}>{value.value}</option>)}
                    </select>
                    <Button type="submit" variant="outline" className="h-11">Save mapping</Button>
                  </form>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
