import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ConfirmProvider, useConfirm } from '@/components/confirm-dialog';

function ConfirmHarness() {
  const { confirm } = useConfirm();
  const [result, setResult] = useState('等待');
  return <><button onClick={async () => setResult(String(await confirm({ title: '删除令牌？', description: '此操作不可恢复。' })))}>删除</button><output>{result}</output></>;
}

describe('global confirmation', () => {
  it('uses an accessible alert dialog and resolves cancellation', async () => {
    const user = userEvent.setup();
    render(<ConfirmProvider><ConfirmHarness /></ConfirmProvider>);
    await user.click(screen.getByRole('button', { name: '删除' }));
    expect(screen.getByRole('alertdialog', { name: '删除令牌？' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.getByText('false')).toBeVisible();
  });
});
