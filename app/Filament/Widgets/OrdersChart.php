<?php

namespace App\Filament\Widgets;

use App\Models\Order;
use Filament\Widgets\ChartWidget;
use Illuminate\Support\Carbon;

class OrdersChart extends ChartWidget
{
    protected ?string $heading = '近 10 天订单';

    protected static ?int $sort = 5;

    protected function getData(): array
    {
        [$labels, $values] = $this->dailyCounts();

        return [
            'datasets' => [
                [
                    'label' => '新增订单',
                    'data' => $values,
                    'borderColor' => '#f59e0b',
                    'backgroundColor' => 'rgba(245, 158, 11, 0.15)',
                    'fill' => true,
                    'tension' => 0.3,
                ],
            ],
            'labels' => $labels,
        ];
    }

    protected function getType(): string
    {
        return 'line';
    }

    /**
     * @return array{0: array<int, string>, 1: array<int, int>}
     */
    private function dailyCounts(): array
    {
        $start = Carbon::today()->subDays(9);
        $end = Carbon::today();

        $rows = Order::query()
            ->selectRaw('DATE(created_at) as day, COUNT(*) as total')
            ->whereBetween('created_at', [$start->copy()->startOfDay(), $end->copy()->endOfDay()])
            ->groupBy('day')
            ->pluck('total', 'day');

        $labels = [];
        $values = [];

        for ($cursor = $start->copy(); $cursor->lte($end); $cursor->addDay()) {
            $key = $cursor->toDateString();
            $labels[] = $cursor->format('M j');
            $values[] = (int) ($rows[$key] ?? 0);
        }

        return [$labels, $values];
    }
}
