# Admin Analytics Definitions

The admin dashboard derives management signals from canonical PostgreSQL commerce records. It does not use browser-calculated money or inferred traffic data.

## Selected period

The initial dashboard uses the latest 30 complete rolling days and compares them with the immediately preceding 30-day period. Dates are evaluated in UTC for stable server rendering.

## Metrics

- **Paid sales:** sum of `orders.total_minor` for orders whose related payment status is `PAID` and whose `placed_at` falls in the selected period.
- **Paid orders:** count of those paid orders.
- **Average order value:** paid sales divided by paid orders, rounded to the nearest centavo. It is shown as zero when no paid orders exist.
- **Items sold:** sum of immutable `order_items.quantity` belonging to paid orders in the selected period.
- **Customers:** distinct non-null `orders.user_id` values among paid orders.
- **Top products:** products ranked by paid item quantity, then paid line revenue, during the selected period.
- **Low stock:** available inventory (`on_hand - reserved`) greater than zero and less than or equal to `safety_stock`.
- **Out of stock:** available inventory less than or equal to zero.
- **Slow-moving opportunity:** an active product variant with available stock and no paid units in the selected period. This is an early merchandising signal, not a judgment of product quality.
- **Pending GCash:** Manual GCash payments in `SUBMITTED` state awaiting staff review.

## Comparisons and sparse data

Percentage change is displayed only when the previous period has a non-zero denominator. Otherwise the interface says that comparison is unavailable. Product insights use cautious language when the selected period contains limited history.

## Unsupported analytics

The current schema does not authoritatively record sessions, page views, referrers, UTM attribution, product-view events, or checkout funnel events. Therefore the dashboard does not display traffic, conversion rate, CTR, ROAS, or campaign attribution.

## Sell-through and ABC analysis

Sell-through is not shown because historical opening inventory for the selected period cannot be reconstructed reliably from the current read model. ABC classification is withheld when paid product history is too sparse to support a useful cumulative-revenue grouping.
