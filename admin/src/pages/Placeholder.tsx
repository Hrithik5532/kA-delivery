import { Page } from '@/components/Layout';

export function Placeholder({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <Page title={title}>
      <div className="placeholder-card">
        <div className="placeholder-icon">◆</div>
        <h2>{title}</h2>
        <p className="muted">{subtitle ?? 'This module is coming soon. Use the dashboard and existing screens for live operations.'}</p>
      </div>
    </Page>
  );
}
