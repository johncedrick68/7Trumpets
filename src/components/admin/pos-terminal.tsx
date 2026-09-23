"use client";

import * as React from "react";
import { 
  Banknote, 
  Check, 
  Minus, 
  Plus, 
  QrCode, 
  Receipt, 
  ShoppingBag, 
  Trash2, 
  User, 
  X,
  Calculator,
  Printer
} from "lucide-react";
import { formatMinorUnitsToPHP } from "@/lib/money";
import { processPosCounterSaleAction } from "@/lib/pos/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SearchField } from "@/components/admin/search-field";
import { Label } from "@/components/ui/label";

export interface PosVariant {
  id: string;
  sku: string;
  title: string;
  price_minor: number;
  is_active: boolean;
  available_count: number;
}

export interface PosProduct {
  id: string;
  title: string;
  slug: string;
  category_id: string | null;
  image_url: string | null;
  variants: PosVariant[];
}

export interface PosCategory {
  id: string;
  name: string;
  slug: string;
}

export interface ActiveSessionInfo {
  id: string;
  opening_cash_minor: number;
  expected_cash_minor: number;
  opened_at: string;
  status: string;
}

interface CartItem {
  variant_id: string;
  product_title: string;
  variant_title: string;
  sku: string;
  unit_price_minor: number;
  quantity: number;
  available_count: number;
}

interface PosTerminalProps {
  products: PosProduct[];
  categories: PosCategory[];
  cashierEmail: string;
  activeSession: ActiveSessionInfo | null;
  gcashAccount: {
    enabled: boolean;
    number: string;
    accountName: string;
  };
  completedSaleInfo?: {
    orderNumber: string;
    changeMinor: number;
  } | null;
}

export function PosTerminal({ 
  products, 
  categories, 
  cashierEmail,
  activeSession,
  gcashAccount,
  completedSaleInfo
}: PosTerminalProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = React.useState<"CASH" | "MANUAL_GCASH">("CASH");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showCustomerDetails, setShowCustomerDetails] = React.useState(false);
  const [customerName, setCustomerName] = React.useState("Walk-in Customer");
  const [customerPhone, setCustomerPhone] = React.useState("");

  // Cash Calculator state (in whole PHP pesos)
  const [tenderedPesos, setTenderedPesos] = React.useState<string>("");
  const [showReceiptModal, setShowReceiptModal] = React.useState(Boolean(completedSaleInfo));
  const [showReprintModal, setShowReprintModal] = React.useState(false);
  const [isSaleTicketVisible, setIsSaleTicketVisible] = React.useState(false);
  const [reprintOrderNumber, setReprintOrderNumber] = React.useState("");
  const [activeReceipt, setActiveReceipt] = React.useState<{
    orderNumber: string;
    changeMinor: number;
    totalMinor?: number;
    tenderedMinor?: number;
    method?: string;
  } | null>(completedSaleInfo ? {
    orderNumber: completedSaleInfo.orderNumber,
    changeMinor: completedSaleInfo.changeMinor,
  } : null);

  const handleReprintSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reprintOrderNumber.trim()) return;
    setActiveReceipt({
      orderNumber: reprintOrderNumber.trim().toUpperCase(),
      changeMinor: 0,
      totalMinor: 0,
    });
    setShowReprintModal(false);
    setShowReceiptModal(true);
  };

  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const saleTicketRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const ticket = saleTicketRef.current;
    if (!ticket) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsSaleTicketVisible(entry.isIntersecting),
      { threshold: 0.05 }
    );
    observer.observe(ticket);
    return () => observer.disconnect();
  }, []);

  // Keyboard shortcut: Press '/' to focus search
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filter products
  const filteredProducts = React.useMemo(() => {
    return products.filter((product) => {
      const matchesCategory = !selectedCategory || product.category_id === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        product.title.toLowerCase().includes(q) ||
        product.variants.some((v) => v.title.toLowerCase().includes(q) || v.sku.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Cart operations
  const addToCart = (product: PosProduct, variant: PosVariant) => {
    if (!activeSession || variant.available_count <= 0) return;

    setCart((prev) => {
      const existing = prev.find((item) => item.variant_id === variant.id);
      if (existing) {
        if (existing.quantity >= variant.available_count) return prev;
        return prev.map((item) =>
          item.variant_id === variant.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          variant_id: variant.id,
          product_title: product.title,
          variant_title: variant.title,
          sku: variant.sku,
          unit_price_minor: variant.price_minor,
          quantity: 1,
          available_count: variant.available_count,
        },
      ];
    });
  };

  const updateQuantity = (variant_id: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.variant_id !== variant_id) return item;
          const nextQty = item.quantity + delta;
          if (nextQty <= 0) return null;
          if (nextQty > item.available_count) return item;
          return { ...item, quantity: nextQty };
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeItem = (variant_id: string) => {
    setCart((prev) => prev.filter((item) => item.variant_id !== variant_id));
  };

  const clearCart = () => {
    setCart([]);
    setTenderedPesos("");
  };

  // Calculations
  const subtotalMinor = cart.reduce(
    (sum, item) => sum + item.unit_price_minor * item.quantity,
    0
  );
  const totalMinor = subtotalMinor;
  const totalPesos = totalMinor / 100;

  // Tender minor calculation
  const enteredTenderedMinor = tenderedPesos
    ? Math.round(parseFloat(tenderedPesos) * 100)
    : 0;
  
  const changeMinor = Math.max(0, enteredTenderedMinor - totalMinor);
  const isTenderInsufficient = paymentMethod === "CASH" && totalMinor > 0 && enteredTenderedMinor < totalMinor;

  // Pre-calculated tender options for quick tap
  const quickTenderOptions = React.useMemo(() => {
    if (totalPesos <= 0) return [];
    const exact = totalPesos;
    const next500 = Math.ceil(totalPesos / 500) * 500;
    const next1000 = Math.ceil(totalPesos / 1000) * 1000;
    const set = new Set([exact, next500, next1000, 2000, 5000].filter((v) => v >= exact));
    return Array.from(set).sort((a, b) => a - b).slice(0, 4);
  }, [totalPesos]);

  return (
    <div className="grid grid-cols-1 items-start gap-6 pb-20 lg:grid-cols-12 lg:pb-0">
      {/* ── Left Side: Product Browser (7 Cols) ───────────────────── */}
      <div className="lg:col-span-7 space-y-4">
        {/* Search and Category Filter Bar */}
        <Card className="border-border shadow-xs">
          <CardContent className="p-4 space-y-3">
            <div>
              <SearchField
                ref={searchInputRef}
                placeholder="Search products or SKU…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClear={() => setSearchQuery("")}
                aria-label="Search products or SKU"
                className="h-11 text-sm"
              />
            </div>

            {/* Categories Pills & Reprint Button */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 text-xs [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex items-center gap-1.5">
                <Button
                  variant={selectedCategory === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                  className="!h-11 text-xs font-mono lg:!h-7"
                >
                  ALL
                </Button>
                {categories.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={selectedCategory === cat.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(cat.id)}
                    className="!h-11 whitespace-nowrap text-xs font-mono lg:!h-7"
                  >
                    {cat.name}
                  </Button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowReprintModal(true)}
                className="ml-auto !h-11 shrink-0 gap-1 text-xs font-mono lg:!h-7"
              >
                <Receipt className="size-3.5" />
                <span>Reprint Receipt</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Products Grid */}
        <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2 2xl:grid-cols-3">
          {filteredProducts.map((product) => {
            const hasStock = product.variants.some((v) => v.available_count > 0);
            return (
              <Card
                key={product.id}
                className={`self-start border-border transition-all flex flex-col justify-between ${
                  !hasStock ? "opacity-60 bg-muted/30" : "hover:border-primary/50 shadow-xs"
                }`}
              >
                <CardHeader className="p-3 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-bold line-clamp-1">
                      {product.title}
                    </CardTitle>
                    {!hasStock && (
                      <Badge variant="destructive" className="text-[9px] px-1.5 py-0 font-mono">
                        OUT
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-3 pt-0 space-y-2">
                  <div className="space-y-1.5 pt-1">
                    {product.variants.map((variant) => {
                      const isOutOfStock = variant.available_count <= 0;
                      return (
                        <button
                          key={variant.id}
                          type="button"
                          disabled={isOutOfStock || !activeSession}
                          onClick={() => addToCart(product, variant)}
                          className={`w-full flex items-center justify-between p-2 rounded-md border text-left text-xs transition-colors ${
                            isOutOfStock || !activeSession
                              ? "border-border/50 text-muted-foreground bg-muted/20 cursor-not-allowed"
                              : "border-border hover:border-primary hover:bg-primary/5 active:bg-primary/10"
                          }`}
                        >
                          <div>
                            <span className="font-bold">{variant.title}</span>
                            <span className="font-mono text-[10px] text-muted-foreground ml-1.5">
                              {variant.sku}
                            </span>
                          </div>

                          <div className="text-right">
                            <div className="font-mono font-bold">
                              {formatMinorUnitsToPHP(variant.price_minor)}
                            </div>
                            <div className={`text-[10px] font-mono ${
                              variant.available_count <= 2 ? "text-rose-600 font-bold" : "text-muted-foreground"
                            }`}>
                              {variant.available_count > 0 ? `${variant.available_count} left` : "0 stock"}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div className="p-12 text-center border border-dashed rounded-lg border-border">
            <ShoppingBag className="size-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="font-bold text-sm">No items found matching criteria</p>
            <p className="text-xs text-muted-foreground mt-1">Try another search keyword or category filter.</p>
          </div>
        )}
      </div>

      {/* ── Right Side: Register Shift & Sale Ticket (5 Cols) ─────── */}
      <aside ref={saleTicketRef} className="space-y-4 scroll-mt-20 lg:sticky lg:top-20 lg:col-span-5">
        {/* Active Register Session Status Banner */}
        {activeSession ? (
          <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs">
            <div>
              <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                Register Drawer Active
              </div>
              <div className="text-muted-foreground font-mono text-[11px] mt-0.5">
                Float: {formatMinorUnitsToPHP(activeSession.opening_cash_minor)} · In Drawer: {formatMinorUnitsToPHP(activeSession.expected_cash_minor)}
              </div>
            </div>
            <Badge variant="outline" className="font-mono text-[10px] bg-background">
              Shift Open
            </Badge>
          </div>
        ) : (
          <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900">
            <div className="font-bold flex items-center gap-1.5">
              ⚠️ Register Drawer Closed
            </div>
            <div className="text-[11px] text-amber-800 mt-0.5">
              Open the register from the page header before adding items or completing a sale.
            </div>
          </div>
        )}

        {/* Current Sale Ticket Card */}
        <Card className="border-border shadow-sm">
          <CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Receipt className="size-4 text-primary" />
                Active Sale Ticket
              </CardTitle>
              <p className="text-xs font-mono text-muted-foreground">
                {cart.reduce((sum, item) => sum + item.quantity, 0)} items in basket
              </p>
            </div>

            {cart.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearCart}
                className="h-8 text-xs text-muted-foreground hover:text-destructive"
              >
                Clear
              </Button>
            )}
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            {/* Cart Items List */}
            {cart.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground space-y-1">
                <ShoppingBag className="size-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-xs font-medium">Ticket is empty</p>
                <p className="text-[11px]">Select items on the left to add them to this sale.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60 max-h-60 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={item.variant_id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{item.product_title}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {item.variant_title} · {item.sku}
                      </p>
                      <p className="font-mono text-[11px] font-medium text-foreground mt-0.5">
                        {formatMinorUnitsToPHP(item.unit_price_minor)} each
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => updateQuantity(item.variant_id, -1)}
                        className="size-11 lg:size-7"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="size-3" />
                      </Button>
                      <span className="font-mono font-bold w-6 text-center text-xs">
                        {item.quantity}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => updateQuantity(item.variant_id, 1)}
                        disabled={item.quantity >= item.available_count}
                        className="size-11 lg:size-7"
                        aria-label="Increase quantity"
                      >
                        <Plus className="size-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item.variant_id)}
                        className="ml-1 size-11 text-muted-foreground hover:text-destructive lg:size-7"
                        aria-label="Remove item"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Customer Details Toggle */}
            <div className="pt-3 border-t border-border space-y-3">
              <button
                type="button"
                onClick={() => setShowCustomerDetails((prev) => !prev)}
                className="flex min-h-11 w-full items-center justify-between text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                <span className="flex items-center gap-1.5 font-bold">
                  <User className="size-3.5" />
                  Customer: {customerName}
                </span>
                <span>{showCustomerDetails ? "▲ Hide" : "▼ Edit"}</span>
              </button>

              {showCustomerDetails && (
                <div className="space-y-3 p-3 bg-muted/30 border border-border rounded-lg text-xs">
                  <div>
                    <Label htmlFor="pos_customer_name" className="text-[11px]">Customer Name</Label>
                    <Input
                      id="pos_customer_name"
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Walk-in Customer"
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pos_customer_phone" className="text-[11px]">Phone (Optional)</Label>
                    <Input
                      id="pos_customer_phone"
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="0917 XXX XXXX"
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Payment Method Selector */}
            <div className="pt-3 border-t border-border space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-bold">
                Payment Tender
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("CASH")}
                  className={`flex min-h-11 items-center justify-center gap-2 p-3 rounded-lg border-2 text-xs font-bold transition-all ${
                    paymentMethod === "CASH"
                      ? "border-foreground bg-foreground text-background shadow-xs"
                      : "border-border bg-background text-foreground hover:bg-muted/40"
                  }`}
                >
                  <Banknote className="size-4" />
                  <span>Cash Tender</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("MANUAL_GCASH")}
                  disabled={!gcashAccount.enabled}
                  className={`flex min-h-11 items-center justify-center gap-2 p-3 rounded-lg border-2 text-xs font-bold transition-all ${
                    paymentMethod === "MANUAL_GCASH"
                      ? "border-primary bg-primary text-primary-foreground shadow-xs"
                      : "border-border bg-background text-foreground hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
                  }`}
                >
                  <QrCode className="size-4" />
                  <span>{gcashAccount.enabled ? "GCash Counter QR" : "GCash Unavailable"}</span>
                </button>
              </div>
            </div>

            {/* Cash Calculator (Visible when CASH selected) */}
            {paymentMethod === "CASH" && totalMinor > 0 && (
              <div className="p-3.5 bg-muted/40 border border-border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Calculator className="size-3.5 text-primary" />
                    Cash Tender Calculator
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">PHP ₱</span>
                </div>

                {/* Quick Tender Preset Buttons */}
                <div className="grid grid-cols-4 gap-1.5">
                  {quickTenderOptions.map((opt) => (
                    <Button
                      key={opt}
                      type="button"
                      variant={parseFloat(tenderedPesos) === opt ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTenderedPesos(opt.toString())}
                      className="h-11 text-xs font-mono font-bold lg:h-8"
                    >
                      ₱{opt.toLocaleString()}
                    </Button>
                  ))}
                </div>

                {/* Custom Tender Input */}
                <div>
                  <Label htmlFor="tendered_input" className="text-[11px] text-muted-foreground">
                    Cash Tendered Amount
                  </Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-sm text-muted-foreground">
                      ₱
                    </span>
                    <Input
                      id="tendered_input"
                      type="number"
                      step="any"
                      min={0}
                      placeholder={totalPesos.toString()}
                      value={tenderedPesos}
                      onChange={(e) => setTenderedPesos(e.target.value)}
                      className="pl-7 font-mono font-bold text-base h-10"
                    />
                  </div>
                </div>

                {/* Change Calculation Box */}
                <div className={`p-2.5 rounded-md flex items-center justify-between text-xs font-mono ${
                  isTenderInsufficient
                    ? "bg-rose-50 text-rose-800 border border-rose-200"
                    : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                }`}>
                  <span className="font-bold">
                    {isTenderInsufficient ? "Shortage:" : "Change to Customer:"}
                  </span>
                  <span className="text-sm font-black">
                    {isTenderInsufficient
                      ? formatMinorUnitsToPHP(totalMinor - enteredTenderedMinor)
                      : formatMinorUnitsToPHP(changeMinor)}
                  </span>
                </div>
              </div>
            )}

            {/* GCash Counter Input */}
            {paymentMethod === "MANUAL_GCASH" && totalMinor > 0 && (
              <div className="p-3.5 bg-muted/40 border border-border rounded-lg space-y-2 text-xs">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <QrCode className="size-4 text-primary" />
                  Store Counter GCash Transfer
                </div>
                <p className="text-muted-foreground text-[11px]">
                  Confirm the customer has transferred <strong>{formatMinorUnitsToPHP(totalMinor)}</strong> to <strong>{gcashAccount.number}</strong> ({gcashAccount.accountName}) before completing the sale.
                </p>
              </div>
            )}

            {/* Totals Breakdown */}
            <div className="pt-4 border-t border-border space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground text-xs">
                <span>Subtotal ({cart.length} items)</span>
                <span className="font-mono font-medium">{formatMinorUnitsToPHP(subtotalMinor)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground text-xs">
                <span>Fulfillment Handover</span>
                <span className="font-mono font-medium text-emerald-700">Counter Pickup (₱0.00)</span>
              </div>
              <div className="flex justify-between items-end pt-2 border-t border-border text-foreground">
                <span className="font-bold text-base">Total Due</span>
                <span className="font-mono font-black text-2xl">{formatMinorUnitsToPHP(totalMinor)}</span>
              </div>
            </div>

            {/* Complete Sale Form */}
            <form
              action={async (formData: FormData) => {
                if (!activeSession || cart.length === 0 || isTenderInsufficient) return;
                setIsSubmitting(true);
                try {
                  const itemsPayload = JSON.stringify(
                    cart.map((item) => ({
                      variant_id: item.variant_id,
                      quantity: item.quantity,
                    }))
                  );
                  formData.set("items_json", itemsPayload);
                  formData.set("payment_method", paymentMethod);
                  formData.set("tendered_minor", (paymentMethod === "CASH" ? enteredTenderedMinor : totalMinor).toString());
                  formData.set("customer_name", customerName);
                  formData.set("customer_phone", customerPhone);
                  if (activeSession?.id) {
                    formData.set("register_session_id", activeSession.id);
                  }

                  await processPosCounterSaleAction(formData);
                } catch {
                  setIsSubmitting(false);
                }
              }}
            >
              <Button
                type="submit"
                size="lg"
                disabled={!activeSession || cart.length === 0 || isSubmitting || isTenderInsufficient}
                className="min-h-12 w-full gap-2 text-base font-extrabold uppercase tracking-wide shadow-md"
              >
                {isSubmitting ? (
                  <span>Processing Counter Sale...</span>
                ) : !activeSession ? (
                  <span>Open Register to Start Sale</span>
                ) : isTenderInsufficient ? (
                  <span>Insufficient Cash Tendered</span>
                ) : (
                  <>
                    <Check className="size-5" />
                    <span>Complete Sale · {formatMinorUnitsToPHP(totalMinor)}</span>
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </aside>

      {cart.length > 0 && !isSaleTicketVisible && (
        <button
          type="button"
          onClick={() => saleTicketRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="fixed inset-x-4 bottom-4 z-40 flex min-h-14 items-center justify-between rounded-xl bg-neutral-950 px-5 text-sm font-semibold text-white shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:hidden"
          aria-label={`Review current sale with ${cart.reduce((sum, item) => sum + item.quantity, 0)} items totaling ${formatMinorUnitsToPHP(totalMinor)}`}
        >
          <span>{cart.reduce((sum, item) => sum + item.quantity, 0)} items · Review sale</span>
          <span className="font-mono">{formatMinorUnitsToPHP(totalMinor)}</span>
        </button>
      )}

      {/* ── Itemized POS Receipt Modal & Thermal Print Slip ────────────── */}
      {showReceiptModal && (activeReceipt || completedSaleInfo) && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:static print:bg-transparent">
          <div className="w-full max-w-sm border-2 border-primary/20 shadow-2xl bg-card rounded-xl p-6 print:border-none print:shadow-none print:max-w-none print:w-[80mm] print:m-0 print:p-2">
            {/* Thermal Receipt Body */}
            <div className="font-mono text-xs space-y-3 text-foreground">
              <div className="text-center pb-2 border-b border-dashed border-border">
                <h3 className="font-black text-base tracking-tight">1968 CLOTHING</h3>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Flagship Retail Store · Manila</p>
                <p className="text-[9px] text-muted-foreground">TIN: 196-800-000-000-VAT</p>
                <p className="text-[9px] text-muted-foreground">Makati Cultural District, Metro Manila</p>
              </div>

              <div className="text-[10px] space-y-0.5 border-b border-dashed border-border pb-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">INVOICE / ORDER:</span>
                  <span className="font-bold">{activeReceipt?.orderNumber || completedSaleInfo?.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">DATE:</span>
                  <span>{new Date().toLocaleDateString("en-PH", { dateStyle: "short", timeStyle: "short" })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CASHIER:</span>
                  <span className="truncate max-w-[160px]">{cashierEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CHANNEL:</span>
                  <span>POS Counter (In-Person)</span>
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-1 border-b border-dashed border-border pb-2 text-[10px]">
                <div className="flex justify-between font-bold text-muted-foreground pb-0.5 border-b border-border/50">
                  <span>ITEM / SKU</span>
                  <span>TOTAL</span>
                </div>
                {cart.length > 0 ? (
                  cart.map((item) => (
                    <div key={item.variant_id} className="flex justify-between py-0.5">
                      <div className="flex flex-col">
                        <span className="font-bold">{item.product_title}</span>
                        <span className="text-[9px] text-muted-foreground">{item.sku} × {item.quantity}</span>
                      </div>
                      <span className="font-bold">{formatMinorUnitsToPHP(item.unit_price_minor * item.quantity)}</span>
                    </div>
                  ))
                ) : (
                  <div className="py-1 text-center text-muted-foreground italic">
                    Counter Sale Completed
                  </div>
                )}
              </div>

              {/* Financial Totals */}
              <div className="space-y-1 text-[11px] border-b border-dashed border-border pb-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-bold">{formatMinorUnitsToPHP(totalMinor || 0)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>VAT (12% Included):</span>
                  <span>{formatMinorUnitsToPHP(Math.round((totalMinor || 0) * 0.12 / 1.12))}</span>
                </div>
                <div className="flex justify-between font-extrabold text-sm pt-1 border-t border-border">
                  <span>TOTAL AMOUNT:</span>
                  <span>{formatMinorUnitsToPHP(totalMinor || 0)}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Payment Method:</span>
                  <span className="font-bold uppercase">{paymentMethod}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Tendered:</span>
                  <span>{enteredTenderedMinor > 0 ? formatMinorUnitsToPHP(enteredTenderedMinor) : formatMinorUnitsToPHP(totalMinor || 0)}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-600 text-[11px]">
                  <span>Change Given:</span>
                  <span>{formatMinorUnitsToPHP(activeReceipt?.changeMinor ?? completedSaleInfo?.changeMinor ?? 0)}</span>
                </div>
              </div>

              {/* Return Policy Notice & Barcode */}
              <div className="text-center pt-1 space-y-2 text-[9px] text-muted-foreground">
                <p>Exchange valid within 7 days with this official receipt and tags attached.</p>
                <div className="bg-muted p-1.5 rounded text-center tracking-widest font-mono text-[10px] select-all font-bold text-foreground">
                  *{(activeReceipt?.orderNumber || completedSaleInfo?.orderNumber || "").replace(/[^A-Z0-9]/g, "")}*
                </div>
                <p className="text-[8px] uppercase tracking-wider">Thank you for supporting Filipino Streetwear</p>
              </div>
            </div>

            {/* Modal Buttons (hidden during print) */}
            <div className="flex gap-2 mt-4 print:hidden">
              <Button
                type="button"
                variant="outline"
                onClick={() => window.print()}
                className="flex-1 gap-1.5 text-xs font-mono"
              >
                <Printer className="size-3.5" />
                Print Slip
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setShowReceiptModal(false);
                  setActiveReceipt(null);
                }}
                className="flex-1 text-xs font-mono"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reprint Receipt Modal ─────────────────────────────────── */}
      {showReprintModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-sm border-border shadow-2xl animate-in fade-in zoom-in-95">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Receipt className="size-4" />
                  Reprint POS Receipt
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Enter order number to generate duplicate slip
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReprintModal(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Close reprint dialog"
              >
                <X className="size-4" />
              </button>
            </CardHeader>
            <CardContent className="p-4 pt-4">
              <form onSubmit={handleReprintSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reprint-order-no" className="text-xs font-mono">
                    Order Number
                  </Label>
                  <Input
                    id="reprint-order-no"
                    placeholder="e.g. ORD-20260920-..."
                    value={reprintOrderNumber}
                    onChange={(e) => setReprintOrderNumber(e.target.value)}
                    className="font-mono text-xs uppercase"
                    required
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowReprintModal(false)}
                    className="flex-1 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 text-xs font-bold gap-1.5"
                  >
                    <Printer className="size-3.5" />
                    Load &amp; Print
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
