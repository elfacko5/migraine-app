import { useState } from 'react';
import type { Attack, Snapshot } from '../types';
import { isoToLocalInput, localInputToIso } from '../utils/format';
import { AreaSeverityPicker } from './AreaSeverityPicker';
import { ChipSelector } from './ChipSelector';
import { MedicationInput } from './MedicationInput';
import { SeverityChart } from './SeverityChart';
import { SnapshotRow } from './SnapshotRow';

interface Props {
  attack: Attack;
  symptoms: string[];
  reliefs: string[];
  recentMeds: Array<{ name: string; dose: string }>;
  onAddSymptom: (s: string) => void;
  onAddRelief: (r: string) => void;
  onSave: (snapshot: Omit<Snapshot, 'source'>) => void;
  onNoChange: () => void;
  onClose: () => void;
}

export function QuickUpdateForm({ attack, symptoms, reliefs, recentMeds, onAddSymptom, onAddRelief, onSave, onNoChange, onClose }: Props) {
  const prev = attack.snapshots[attack.snapshots.length - 1];

  const [showForm, setShowForm] = useState(false);
  const [areas, setAreas] = useState<Record<string, number>>({ ...prev.areas });
  const [symptomsSel, setSymptomsSel] = useState<string[]>([...prev.symptoms]);
  const [reliefsSel, setReliefsSel] = useState<string[]>([...(prev.reliefs ?? [])]);
  const [medication, setMedication] = useState({ name: '', dose: '' });
  const [note, setNote] = useState('');
  const [time, setTime] = useState(isoToLocalInput());

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      time: localInputToIso(time),
      areas,
      symptoms: symptomsSel,
      reliefs: reliefsSel,
      medication: medication.name.trim() ? { name: medication.name.trim(), dose: medication.dose } : null,
      note: note.trim() || null,
    });
  }

  return (
    <div className="space-y-5">
      {/* Attack history */}
      {attack.snapshots.length >= 2 && (
        <SeverityChart attack={attack} height={150} />
      )}

      <div>
        <p className="text-xs uppercase tracking-wider font-medium text-text-secondary mb-3">History</p>
        {[...attack.snapshots].reverse().map((snap, i, arr) => (
          <SnapshotRow key={i} snap={snap} isFirst={i === arr.length - 1} />
        ))}
      </div>

      <div className="border-t border-bg-border" />

      {!showForm ? (
        /* Two action buttons */
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onNoChange}
            className="w-full rounded-xl border border-bg-border bg-bg-raised/60 py-3 text-sm font-medium text-text-primary hover:bg-bg-border transition-colors"
          >
            Nothing changed — log no change
          </button>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-bg-base hover:bg-accent-light transition-colors"
          >
            Log what changed
          </button>
        </div>
      ) : (
        /* Full form — revealed after tapping Log what changed */
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Time */}
          <section className="space-y-1">
            <Label>Update time</Label>
            <input
              type="datetime-local"
              value={time}
              max={isoToLocalInput()}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-lg bg-bg-raised border border-bg-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </section>

          {/* Pain areas — pre-filled from prev snapshot */}
          <section className="space-y-2">
            <Label>Pain areas & severity</Label>
            <p className="text-xs text-text-secondary">Pre-filled from previous update — adjust what changed.</p>
            <AreaSeverityPicker value={areas} onChange={setAreas} />
          </section>

          {/* Symptoms */}
          <section className="space-y-2">
            <Label>Symptoms</Label>
            <ChipSelector options={symptoms} selected={symptomsSel} onChange={setSymptomsSel} onAddCustom={onAddSymptom} />
          </section>

          {/* Relief methods */}
          <section className="space-y-2">
            <Label>Relief methods</Label>
            <ChipSelector options={reliefs} selected={reliefsSel} onChange={setReliefsSel} onAddCustom={onAddRelief} />
          </section>

          {/* Medication */}
          <section className="space-y-2">
            <Label>Medication taken (optional)</Label>
            <MedicationInput value={medication} onChange={setMedication} recentMeds={recentMeds} />
          </section>

          {/* Note */}
          <section className="space-y-2">
            <Label>Note (optional)</Label>
            <textarea
              rows={2}
              value={note}
              placeholder="What changed?"
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg bg-bg-raised border border-bg-border px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            />
          </section>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-bg-border py-3 text-sm font-medium text-text-secondary hover:bg-bg-raised transition-colors">
              Cancel
            </button>
            <button type="submit" className="flex-1 rounded-xl bg-accent py-3 text-sm font-semibold text-bg-base hover:bg-accent-light transition-colors">
              Save update
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs uppercase tracking-wider font-medium text-text-secondary">{children}</p>;
}
