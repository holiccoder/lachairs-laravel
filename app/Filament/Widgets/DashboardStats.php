<?php

namespace App\Filament\Widgets;

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\User;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class DashboardStats extends BaseWidget
{
    protected static ?int $sort = 1;

    protected function getColumns(): int
    {
        return 4;
    }

    protected function getStats(): array
    {
        return [
            Stat::make('商品总数', Product::count())
                ->description('全部目录商品')
                ->descriptionIcon('heroicon-m-cube')
                ->color('success'),
            Stat::make('分类数量', ProductCategory::count())
                ->description('商品分类')
                ->descriptionIcon('heroicon-m-rectangle-stack')
                ->color('primary'),
            Stat::make('用户总数', User::count())
                ->description('已注册客户')
                ->descriptionIcon('heroicon-m-users')
                ->color('info'),
            Stat::make('订单总数', Order::count())
                ->description('累计订单数')
                ->descriptionIcon('heroicon-m-shopping-bag')
                ->color('warning'),
        ];
    }
}
