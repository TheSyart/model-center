import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

describe('visual component library', () => {
  it('composes form controls with native labels', () => {
    render(
      <div>
        <Label htmlFor="provider-name">名称</Label>
        <Input id="provider-name" />
        <Textarea aria-label="备注" />
      </div>,
    );
    expect(screen.getByLabelText('名称')).toBeVisible();
    expect(screen.getByRole('textbox', { name: '备注' })).toBeVisible();
  });

  it('composes status and surface primitives', () => {
    render(
      <Card>
        <CardHeader><CardTitle>服务商状态</CardTitle></CardHeader>
        <CardContent>
          <Badge>已启用</Badge>
          <Progress value={42} aria-label="额度已用" />
          <Skeleton data-testid="skeleton" />
        </CardContent>
      </Card>,
    );
    expect(screen.getByText('服务商状态')).toBeVisible();
    expect(screen.getByRole('progressbar', { name: '额度已用' })).toHaveAttribute('aria-valuenow', '42');
    expect(screen.getByTestId('skeleton')).toBeVisible();
  });

  it('has no serious accessibility violations in a representative form surface', async () => {
    const { container } = render(
      <main>
        <Card>
          <CardHeader><CardTitle>服务商设置</CardTitle></CardHeader>
          <CardContent>
            <Label htmlFor="endpoint">Base URL</Label>
            <Input id="endpoint" required aria-describedby="endpoint-help" />
            <p id="endpoint-help">请输入 HTTPS 地址</p>
            <Progress value={42} aria-label="额度已用" />
          </CardContent>
        </Card>
      </main>,
    );
    const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious')).toEqual([]);
  });
});
