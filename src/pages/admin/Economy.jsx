import { useState } from 'react';
import { supabase, must, niceError } from '../../lib/supabase';
import { useLoad } from '../../lib/hooks';
import { addMonths, kr, keyMonthTitle, keyShort, monthBounds, num, todayKey, fmtDateShort } from '../../lib/format';
import { ConfirmButton, Empty, Field, LoadError, Sheet, Spinner, Stat, useToast } from '../../components/ui';
import { IconChevronLeft, IconChevronRight, IconPlus } from '../../components/icons';

const CATEGORIES = ['Materialer', 'Husleje', 'Udstyr', 'Markedsføring', 'Kurser', 'Andet'];

export default function Economy() {
  const toast = useToast();
  const [month, setMonth] = useState(todayKey().slice(0, 7));
  const [adding, setAdding] = useState(false);
  const { data, error, loading, reload } = useLoad(async () => {
    const [from, to] = monthBounds(month);
    const [expenses, income, products] = await Promise.all([
      supabase.from('expenses').select('*, product:products(name, unit)').gte('spent_on', month + '-01').lt('spent_on', addMonths(month, 1) + '-01').order('spent_on', { ascending: false }).then(must),
      supabase.from('bookings').select('id, price, starts_at, service_name, customer:customers(full_name)').eq('status', 'completed').gte('starts_at', from).lt('starts_at', to).order('starts_at', { ascending: false }).then(must),
      supabase.from('products').select('id, name, unit').order('name').then(must),
    ]);
    return { expenses, income, products };
  }, [month]);

  if (loading && !data) return <Spinner />;
  if (error && !data) return <LoadError error={error} onRetry={reload} />;

  const inc = data.income.reduce((s, b) => s + Number(b.price), 0);
  const out = data.expenses.reduce((s, e) => s + Number(e.amount), 0);
  const isNow = month === todayKey().slice(0, 7);

  async function remove(e) {
    try {
      must(await supabase.rpc('delete_expense', { p_expense_id: e.id }));
      toast(e.product_id ? 'Udgiften er slettet, og varerne er trukket fra lageret' : 'Udgiften er slettet');
      reload();
    } catch (err) {
      toast(niceError(err));
    }
  }

  return (
    <div className="stack-lg">
      <div className="page-title">
        <div className="grow">
          <p className="eyebrow">Økonomi</p>
          <h1>{keyMonthTitle(month + '-01')}</h1>
        </div>
        <button className="icon-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label="Forrige måned"><IconChevronLeft /></button>
        {!isNow && <button className="btn small ghost" onClick={() => setMonth(todayKey().slice(0, 7))}>Nu</button>}
        <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} aria-label="Næste måned"><IconChevronRight /></button>
      </div>

      <div className="stats">
        <Stat label="Indtjening" value={kr(inc)} />
        <Stat label="Udgifter" value={kr(out)} />
        <Stat label="Overskud" value={kr(inc - out)} tone={inc - out >= 0 ? 'pos' : 'neg'} />
      </div>

      <button className="btn gold" onClick={() => setAdding(true)}><IconPlus /> Registrér udgift</button>

      <section className="stack-sm">
        <h2>Udgifter</h2>
        {!data.expenses.length ? <Empty>Ingen udgifter i denne måned.</Empty> : (
          <ul className="list">
            {data.expenses.map((e) => (
              <li key={e.id} className="row static">
                <span className="tx out">−</span>
                <span className="grow">
                  <strong>{e.description || e.category}</strong>
                  <span className="muted">{keyShort(e.spent_on)} · {e.category}{e.product ? ` · +${Number(e.product_qty)} ${e.product.unit} ${e.product.name} på lager` : ''}</span>
                </span>
                <span className="end">
                  <span className="num">−{kr(e.amount)}</span>
                  <ConfirmButton className="link small danger-text" confirmText="Slet?" onConfirm={() => remove(e)}>Slet</ConfirmButton>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="stack-sm">
        <h2>Indtjening</h2>
        <p className="muted small">Tider du har markeret som gennemført i kalenderen.</p>
        {!data.income.length ? <Empty>Ingen gennemførte tider i denne måned.</Empty> : (
          <ul className="list">
            {data.income.map((b) => (
              <li key={b.id} className="row static">
                <span className="tx in">+</span>
                <span className="grow">
                  <strong>{b.customer?.full_name || 'Slettet kunde'}</strong>
                  <span className="muted">{fmtDateShort(b.starts_at)} · {b.service_name}</span>
                </span>
                <span className="end num pos-text">{kr(b.price)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {adding && <ExpenseSheet products={data.products} onClose={() => setAdding(false)} onDone={(d) => { setMonth(d.slice(0, 7)); reload(); }} />}
    </div>
  );
}

function ExpenseSheet({ products, onClose, onDone }) {
  const toast = useToast();
  const [f, setF] = useState({ amount: '', spent_on: todayKey(), description: '', category: 'Materialer' });
  const [toStock, setToStock] = useState(false);
  const [productId, setProductId] = useState('');
  const [newName, setNewName] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('stk');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function save(e) {
    e.preventDefault();
    if (!num(f.amount)) return toast('Skriv et beløb.');
    if (toStock && (!num(qty) || (!productId && !newName.trim()))) return toast('Vælg vare og antal, eller fjern fluebenet.');
    setBusy(true);
    try {
      must(await supabase.rpc('add_expense', {
        p_spent_on: f.spent_on,
        p_amount: num(f.amount),
        p_description: f.description,
        p_category: f.category,
        p_product_id: toStock && productId && productId !== 'new' ? productId : null,
        p_new_product_name: toStock && productId === 'new' ? newName : null,
        p_qty: toStock ? num(qty) : null,
        p_unit: unit,
      }));
      toast(toStock ? 'Udgiften er gemt, og varerne er lagt på lager' : 'Udgiften er gemt');
      onDone(f.spent_on);
      onClose();
    } catch (err) {
      toast(niceError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title="Registrér udgift" onClose={onClose}>
      <form className="stack" onSubmit={save}>
        <div className="two">
          <Field label="Beløb (kr.)"><input inputMode="decimal" value={f.amount} onChange={set('amount')} required placeholder="0" /></Field>
          <Field label="Dato"><input type="date" value={f.spent_on} onChange={set('spent_on')} required /></Field>
        </div>
        <Field label="Beskrivelse"><input value={f.description} onChange={set('description')} placeholder="Fx 6 flasker gel fra grossist" /></Field>
        <Field label="Kategori">
          <select value={f.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
        <label className="check">
          <input type="checkbox" checked={toStock} onChange={(e) => setToStock(e.target.checked)} />
          <span>Læg varerne på lager</span>
        </label>
        {toStock && (
          <div className="card stack-sm">
            <Field label="Vare">
              <select value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Vælg vare…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                <option value="new">+ Ny vare</option>
              </select>
            </Field>
            {productId === 'new' && <Field label="Navn på ny vare"><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Fx Gel top coat" /></Field>}
            <div className="two">
              <Field label="Antal"><input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Fx 6" /></Field>
              {productId === 'new' && <Field label="Enhed"><input value={unit} onChange={(e) => setUnit(e.target.value)} /></Field>}
            </div>
            {num(qty) > 0 && num(f.amount) > 0 && <p className="muted small">Pris pr. stk.: {kr(num(f.amount) / num(qty))}</p>}
          </div>
        )}
        <button className="btn gold" disabled={busy}>{busy ? 'Gemmer…' : 'Gem udgift'}</button>
      </form>
    </Sheet>
  );
}
