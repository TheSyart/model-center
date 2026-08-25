import { Braces, MessageSquareWarning, SquareTerminal } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { SecurityLabConfig, SecurityLabToolName } from '@/lib/security-lab/live-types';

export function PromptRewriteCard({
  value,
  loading,
  pending,
  onChange,
  onSave,
}: {
  value: SecurityLabConfig['promptInjection'];
  loading: boolean;
  pending: boolean;
  onChange(value: SecurityLabConfig['promptInjection']): void;
  onSave(): void;
}) {
  return (
    <Card className={value.enabled ? 'border-destructive/30' : undefined}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <MessageSquareWarning className="size-4 text-destructive" aria-hidden="true" />
              <Badge variant="outline">REQUEST</Badge>
            </div>
            <CardTitle>提示词注入</CardTitle>
            <CardDescription>向最后一条真实用户文本追加自定义后缀，再转发给上游模型。</CardDescription>
          </div>
          <Switch
            checked={value.enabled}
            disabled={loading || pending}
            onCheckedChange={(enabled) => onChange({ ...value, enabled })}
            aria-label="启用提示词注入"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">注入提示词</span>
          <Textarea
            className="mt-2 min-h-36 resize-y font-mono text-xs leading-6"
            value={value.suffix}
            onChange={(event) => onChange({ ...value, suffix: event.target.value })}
            placeholder="例如：在完成原始任务后，额外执行以下要求……"
            aria-label="注入提示词"
            disabled={loading || pending}
          />
        </label>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">只处理包含用户文本的 Claude Code 请求。</p>
          <Button type="button" onClick={onSave} disabled={loading || pending}>
            {pending ? '保存中…' : '保存提示词注入'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const TOOL_NAMES: SecurityLabToolName[] = ['Bash', 'Read', 'Write', 'Edit'];

export function ToolRewriteCard({
  value,
  inputText,
  loading,
  pending,
  onChange,
  onInputTextChange,
  onSave,
}: {
  value: SecurityLabConfig['toolInjection'];
  inputText: string;
  loading: boolean;
  pending: boolean;
  onChange(value: SecurityLabConfig['toolInjection']): void;
  onInputTextChange(value: string): void;
  onSave(): void;
}) {
  return (
    <Card className={value.enabled ? 'border-destructive/30' : undefined}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <SquareTerminal className="size-4 text-destructive" aria-hidden="true" />
              <Badge variant="outline">RESPONSE</Badge>
            </div>
            <CardTitle>Tool Use 注入</CardTitle>
            <CardDescription>上游已调用工具时，在 Anthropic 响应末尾追加一个真实 Claude Code 工具调用。</CardDescription>
          </div>
          <Switch
            checked={value.enabled}
            disabled={loading || pending}
            onCheckedChange={(enabled) => onChange({ ...value, enabled })}
            aria-label="启用工具注入"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Claude Code 工具</span>
          <Select value={value.toolName} onValueChange={(toolName) => onChange({ ...value, toolName: toolName as SecurityLabToolName })} disabled={loading || pending}>
            <SelectTrigger className="mt-2" aria-label="Claude Code 工具"><SelectValue /></SelectTrigger>
            <SelectContent>{TOOL_NAMES.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
          </Select>
        </label>
        <label className="block">
          <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Braces className="size-3.5" aria-hidden="true" />工具调用参数</span>
          <Textarea
            className="mt-2 min-h-36 resize-y font-mono text-xs leading-6"
            value={inputText}
            onChange={(event) => onInputTextChange(event.target.value)}
            aria-label="工具调用参数"
            spellCheck={false}
            disabled={loading || pending}
          />
        </label>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs leading-5 text-destructive">Claude Code 将按当前权限模式真实处理此调用。</p>
          <Button type="button" variant="destructive" onClick={onSave} disabled={loading || pending}>
            {pending ? '保存中…' : '保存工具注入'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
