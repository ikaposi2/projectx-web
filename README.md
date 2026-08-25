# projectX-web

React + TypeScript + Vite SPA for Project X.

- Default locale: **nl** (switchable to en)
- Brand name loaded from `projectX-identity` `/brand`
- In cluster: nginx proxies `/api/*` to backend services (identity, time, project, partner, customer, catalog, finance)

## Manager navigation

| View | Purpose |
|------|---------|
| Hour reporting | Weekly timesheet |
| Hour administration | Approve / refuse pending hours |
| Projects | Create from catalog, manage budgets & staffing |
| Finance | Invoices, reserve, VAT, compensation |
| Catalog | Fixed-price offerings (CRUD) |
| Resources | Internal/external consultants (senior, partner, rates) |
| Customers | Customer records, billing fields |

## Run

```bash
npm install
npm run dev
```

Dev proxy (Vite): `/api/identity` → `http://127.0.0.1:8001`. Other services need local instances or cluster port-forward.

Requires identity service locally or via proxy target.
