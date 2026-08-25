import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/providers' }));
vi.mock('next/image', () => ({ default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} /> }));

import { AdminShell } from '@/components/admin-shell';

describe('AdminShell', () => {
  beforeEach(() => localStorage.clear());

  it('exposes grouped navigation and the active route', () => {
    render(<AdminShell><div>页面内容</div></AdminShell>);
    expect(screen.getByRole('navigation', { name: '主导航' })).toBeVisible();
    expect(screen.getByRole('link', { name: /服务商/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('页面内容')).toBeVisible();
  });

  it('persists the desktop sidebar collapsed state', async () => {
    const user = userEvent.setup();
    render(<AdminShell><div>页面内容</div></AdminShell>);
    await user.click(screen.getByRole('button', { name: '折叠侧边栏' }));
    expect(localStorage.getItem('model-center-sidebar-collapsed')).toBe('true');
    expect(screen.getByRole('button', { name: '展开侧边栏' })).toBeVisible();
  });

  it('opens mobile navigation in a focus-managed sheet', async () => {
    const user = userEvent.setup();
    render(<AdminShell><div>页面内容</div></AdminShell>);
    await user.click(screen.getByRole('button', { name: '打开导航' }));
    expect(screen.getByRole('dialog', { name: 'Model Center 导航' })).toBeVisible();
  });
});
