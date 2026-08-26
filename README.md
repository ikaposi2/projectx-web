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
| Projects | Create from catalog, funnel dial, budgets & staffing, kickoff planner |
| Planning | Resource calendar / unavailable blocks; project agenda |
| Finance | Funnel panel, operational, billing (month-scoped T&M + milestone/final), costs, KPIs |
| Reporting | Month picker — funnel, WIP, utilization, delivered, received |
| Catalog | Fixed-price offerings (CRUD) |
| Resources | Internal/external consultants (senior, partner, rates) |
| Customers | Customer records, billing fields, MSP bill-to |

Product flows: [delivery-lifecycle.md](../projectX-docs/docs/architecture/delivery-lifecycle.md).

## Run

```bash
npm install
npm run dev
```

Dev proxy (Vite): `/api/identity` → `http://127.0.0.1:8001`. Other services need local instances or cluster port-forward.

Requires identity service locally or via proxy target.
