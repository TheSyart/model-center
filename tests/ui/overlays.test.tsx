import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

describe('accessible interactive primitives', () => {
  it('opens a dialog and closes it with Escape', async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger>编辑服务商</DialogTrigger>
        <DialogContent>
          <DialogTitle>编辑服务商</DialogTitle>
          <DialogDescription>修改服务商连接信息</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByRole('button', { name: '编辑服务商' }));
    expect(screen.getByRole('dialog', { name: '编辑服务商' })).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: '编辑服务商' })).not.toBeInTheDocument();
  });

  it('switches tab content with semantic tab roles', async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="overview">
        <TabsList aria-label="服务商详情">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="models">模型</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">概览内容</TabsContent>
        <TabsContent value="models">模型内容</TabsContent>
      </Tabs>,
    );

    await user.click(screen.getByRole('tab', { name: '模型' }));
    expect(screen.getByText('模型内容')).toBeVisible();
  });

  it('reports checkbox state through the native accessibility tree', async () => {
    const user = userEvent.setup();
    render(<Checkbox aria-label="包含 API Key" />);
    const checkbox = screen.getByRole('checkbox', { name: '包含 API Key' });
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
  });
});
