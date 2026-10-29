import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Layers } from 'lucide-react';

interface Props {
  title: string;
  module: string;
  phase: string;
}

export function PlaceholderPage({ title, module, phase }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        subtitle={`Module: ${module} • Implementation scheduled for ${phase}`}
      />
      <div className="bg-card rounded-card border border-border p-12 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-full bg-[#252525] border border-border flex items-center justify-center text-accent mb-4">
          <Layers className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-tx">{title}</h3>
        <p className="text-xs text-tx-secondary max-w-sm mt-1">
          This intelligent operations view will connect to Exasol analytical views during {phase}.
        </p>
        <span className="mt-4 px-3 py-1 rounded-pill bg-accent/10 border border-accent/20 text-accent font-mono text-[11px]">
          Target: {phase}
        </span>
      </div>
    </div>
  );
}
