import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

describe('UI primitives', () => {
  it('merges conflicting Tailwind utilities in favor of the caller', () => {
    expect(cn('px-2 text-sm', 'px-4')).toContain('px-4');
    expect(cn('px-2 text-sm', 'px-4')).not.toContain('px-2');
  });

  it('renders a composable button without losing native attributes', () => {
    render(<Button aria-label="新建服务商">新建</Button>);
    expect(screen.getByRole('button', { name: '新建服务商' })).toBeEnabled();
  });

  it('exposes switch state and keyboard interaction', async () => {
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="启用服务商" onCheckedChange={onCheckedChange} />);
    const control = screen.getByRole('switch', { name: '启用服务商' });
    await userEvent.setup().click(control);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});
