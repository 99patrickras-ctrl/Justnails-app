import { useRef, useState } from 'react';
import { supabase, must, niceError } from '../../lib/supabase';
import { useLoad } from '../../lib/hooks';
import { kr, num } from '../../lib/format';
import { ConfirmButton, Empty, Field, LoadError, PageTitle, Sheet, Spinner, useToast } from '../../components/ui';
import { IconPlus } from '../../components/icons';

const stock = (p) => (Number(p.qty) <= 0 ? 'out' : Number(p.min_qty) > 0 && Number(p.qty) <= Number(p.min_qty) ? 'low' : 'ok');

export default function Inventory() {
  const toast = useToast();
  const [edit, setEdit] = useState(null); // product or {} for new
  const [pending, setPending] = useState({});
  const timers = useRef({});
  const { data: products, error, loading, reload } = useLoad(
    async () => must(await supabase.from('products').select('*').order('name')),
    [],
  );

  if (loading && !products) return <Spinner />;
  if (error && !products) return <LoadError error={error} onRetry={reload} />;

  const qtyOf = (p) => pending[p.id] ?? Number(p.qty);
  function bump(p, d) {
    const v = Math.max(0, qtyOf(p) + d);
    setPending((s) => ({ ...s, [p.id]: v }));
    clearTimeout(timers.current[p.id]);
    timers.current[p.id] = setTimeout(async () => {
      try {
        must(await supabase.from('products').update({ qty: v }).eq('id', p.id));
        await reload();
      } catch (e) {
        toast(niceError(e));
      } finally {
        setPending((s) => { const n = { ...s }; if (n[p.id] === v) delete n[p.id]; return n; });
      }
    }, 700);
  }

  const groups = products.reduce((m, p) => ((m[p.category || 'Andet'] ||= []).push(p), m), {});
  const low = products.filter((p) => stock({ ...p, qty: qtyOf(p) }) !== 'ok').length;
  const value = products.reduce((s, p) => s + qtyOf(p) * Number(p.unit_cost), 0);

  return (
    <div className="stack-lg">
      <PageTitle
        eyebrow={value ? `Lagerværdi ${kr(value)}` : 'Lager'}
        title="Lager"
        right={<button className="btn small gold" onClick={() => setEdit({})}><IconPlus /> Ny</button>}
      />
      {low > 0 && <p className="note warn">{low} {low === 1 ? 'vare skal' : 'varer skal'} bestilles.</p>}
      {!products.length ? (
        <Empty action={<button className="btn small gold" onClick={() => setEdit({})}>Tilføj første vare</button>}>
          Hold styr på lak, gel, filer og andet forbrug. Varer du køber, kan også lægges på lager direkte fra en udgift.
        </Empty>
      ) : (
        Object.keys(groups).sort((a, b) => a.localeCompare(b, 'da')).map((g) => (
          <section key={g} className="stack-sm">
            <p className="eyebrow">{g}</p>
            <ul className="list">
              {groups[g].map((p) => {
                const st = stock({ ...p, qty: qtyOf(p) });
                return (
                  <li key={p.id} className={`row inv ${st}`}>
                    <button className="grow plain" onClick={() => setEdit(p)}>
                      <strong>{p.name}</strong>
                      <span className="muted">
                        {st === 'out' ? 'Tom' : st === 'low' ? 'Bestil ny' : Number(p.min_qty) ? `Bestil ved ${Number(p.min_qty)}` : 'Tryk for at rette'}
                        {Number(p.unit_cost) ? ` · ${kr(p.unit_cost)}/${p.unit}` : ''}
                      </span>
                    </button>
                    <span className="stepper">
                      <button onClick={() => bump(p, -1)} aria-label={`Én mindre ${p.name}`}>−</button>
                      <output>{qtyOf(p)}<small>{p.unit}</small></output>
                      <button onClick={() => bump(p, 1)} aria-label={`Én mere ${p.name}`}>+</button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
      {edit && <ProductSheet p={edit} categories={Object.keys(groups)} onClose={() => setEdit(null)} onDone={reload} />}
    </div>
  );
}

function ProductSheet({ p, categories, onClose, onDone }) {
  const toast = useToast();
  const [f, setF] = useState({
    name: p.name || '', category: p.category || '', qty: p.id ? String(Number(p.qty)) : '',
    unit: p.unit || 'stk', min_qty: p.id ? String(Number(p.min_qty)) : '', unit_cost: p.id ? String(Number(p.unit_cost)) : '',
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const cats = [...new Set(['Neglelak', 'Gel', 'Akryl', 'Pleje', 'Værktøj', 'Engangs', ...categories.filter((c) => c !== 'Andet')])];

  async function save(e) {
    e.preventDefault();
    const row = { name: f.name.trim(), category: f.category.trim(), qty: num(f.qty), unit: f.unit.trim() || 'stk', min_qty: num(f.min_qty), unit_cost: num(f.unit_cost) };
    try {
      if (p.id) must(await supabase.from('products').update(row).eq('id', p.id));
      else must(await supabase.from('products').insert(row));
      toast(p.id ? 'Varen er gemt' : 'Varen er tilføjet');
      onDone();
      onClose();
    } catch (err) {
      toast(niceError(err));
    }
  }

  return (
    <Sheet title={p.id ? 'Ret vare' : 'Ny vare'} onClose={onClose}>
      <form className="stack" onSubmit={save}>
        <Field label="Navn"><input value={f.name} onChange={set('name')} required placeholder="Fx Gel top coat" /></Field>
        <Field label="Kategori">
          <input value={f.category} onChange={set('category')} list="cats" placeholder="Fx Gel" />
          <datalist id="cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <div className="two">
          <Field label="På lager"><input inputMode="decimal" value={f.qty} onChange={set('qty')} placeholder="0" /></Field>
          <Field label="Enhed"><input value={f.unit} onChange={set('unit')} list="units" /></Field>
          <datalist id="units"><option value="stk" /><option value="flasker" /><option value="ml" /><option value="pakker" /></datalist>
        </div>
        <div className="two">
          <Field label="Bestil ny ved"><input inputMode="decimal" value={f.min_qty} onChange={set('min_qty')} placeholder="Fx 2" /></Field>
          <Field label="Pris pr. enhed"><input inputMode="decimal" value={f.unit_cost} onChange={set('unit_cost')} placeholder="kr." /></Field>
        </div>
        <button className="btn gold">{p.id ? 'Gem vare' : 'Tilføj vare'}</button>
        {p.id && (
          <ConfirmButton onConfirm={async () => {
            try { must(await supabase.from('products').delete().eq('id', p.id)); toast('Varen er slettet'); onDone(); onClose(); }
            catch (err) { toast(niceError(err)); }
          }}>Slet varen</ConfirmButton>
        )}
      </form>
    </Sheet>
  );
}
