# LaChairs Fullstack

## Project overview

LaChairs Fullstack is a full-stack Laravel + React (Inertia) commerce platform for event furniture. It provides a customer-facing catalog and checkout flow, plus an admin back office for managing products, categories, and operations.

The application includes:

- A DB-backed product catalog with hierarchical categories and catch-all catalog routing.
- Product listing/search and product detail pages for chairs, tables, and accessories.
- Cart and checkout order capture with persisted order items and customer order history.
- Wholesale account registration, contact form intake, and newsletter subscription endpoints.
- A Filament admin panel (`/admin`) for managing products, categories, orders, contacts, subscribers, users, and companies.

## Tech stack

- **Backend:** PHP 8.3, Laravel 13, Inertia Laravel, Sanctum
- **Frontend:** React 18, Vite 6, Tailwind CSS, Headless UI, Framer Motion
- **Admin:** Filament 5

## Local development

```bash
composer setup
composer dev
```

## Catalog data seeding

```bash
php artisan migrate --force
php artisan db:seed --class=ExportedProductCategoriesSeeder --force
php artisan db:seed --class=ExportedProductsSeeder --force
```
