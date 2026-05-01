import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ComposedChart, Line, ReferenceLine,
  LineChart
} from 'recharts';
import {
  Search, Eye, AlertTriangle, TrendingUp, Building2, MapPin,
  Calendar, Filter, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, BarChart2, FileText, Map, Info,
  CheckCircle, XCircle, Snowflake
} from 'lucide-react';
import { STATS, OUTLIERS, SERIE_TOP, DIST_MENSAL, FATOR_SAZONAL } from './data.js';
const SERIE_TOP1 = SERIE_TOP[1] || SERIE_TOP["1"] || [];

/* ─── constantes ─────────────────────────────────────────── */
const MESES = {1:'Jan',2:'Fev',3:'Mar',4:'Abr',5:'Mai',6:'Jun',
               7:'Jul',8:'Ago',9:'Set',10:'Out',11:'Nov',12:'Dez'};

const SEV_CFG = {
  critico:{ label:'Crítico', bg:'bg-red-100',   text:'text-red-700',   dot:'bg-red-500',   hex:'#ef4444' },
  alto:   { label:'Alto',    bg:'bg-orange-100', text:'text-orange-700',dot:'bg-orange-500', hex:'#f97316' },
  medio:  { label:'Médio',   bg:'bg-amber-100',  text:'text-amber-700', dot:'bg-amber-500',  hex:'#f59e0b' },
  baixo:  { label:'Baixo',   bg:'bg-blue-100',   text:'text-blue-700',  dot:'bg-blue-500',   hex:'#3b82f6' },
};

const fmtBRL = v => v == null ? '—'
  : new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(v);
const fmtComp = c => c?.length >= 6 ? `${c.slice(4,6)}/${c.slice(0,4)}` : (c ?? '—');
const fmtPct  = v => v == null ? '—' : `${(v * 100).toFixed(1)}%`;
const PAGE = 100;

/* ─── lookups pré-calculados ─────────────────────────────── */
const MUNICIPIOS = ['todos',...[...new Set(OUTLIERS.map(o=>o.municipio))].sort()];
const ANOS = ['todos',...[...new Set(OUTLIERS.map(o=>o.competencia.slice(0,4)))].sort()];
const COMPS_MAP  = ANOS.reduce((a,ano)=>{
  if(ano==='todos'){ a[ano]=['todos']; return a; }
  const cs=[...new Set(OUTLIERS.filter(o=>o.competencia.startsWith(ano)).map(o=>o.competencia))].sort();
  a[ano]=['todos',...cs];
  return a;
},{});
const ALL_UGS = ['todos',...[...new Set(OUTLIERS.map(o=>o.ug.trim()))].sort()];

/* ─── componentes auxiliares ─────────────────────────────── */
const Badge = ({ sev }) => {
  const c = SEV_CFG[sev];
  if(!c) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
};

const KpiCard = ({ label, value, sub, color, icon: Icon }) => (
  <div className={`bg-white rounded-xl border-l-4 ${color} p-4 shadow-sm`}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {Icon && <Icon size={20} className="text-gray-300 mt-1" />}
    </div>
  </div>
);

const Select = ({ value, onChange, children, className='' }) => (
  <select
    value={value} onChange={e => onChange(e.target.value)}
    className={`text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700
                focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400
                hover:border-gray-300 transition ${className}`}>
    {children}
  </select>
);

const tooltipStyle = {
  contentStyle:{ backgroundColor:'#fff', border:'1px solid #e5e7eb', borderRadius:8, boxShadow:'0 4px 12px rgba(0,0,0,0.08)' },
  labelStyle:{ color:'#374151', fontWeight:600, fontSize:12 },
  itemStyle:{ fontSize:11 },
};

/* ══════════════════════════════════════════════════════════ */
function SIDAO() {
  /* ── estado ── */
  const [tab,        setTab]        = useState('triagem');
  const [selectedId, setSelectedId] = useState(null);
  const [fSev,       setFSev]       = useState('todos');
  const [fMun,       setFMun]       = useState('todos');
  const [fUG,        setFUG]        = useState('todos');
  const [fAno,       setFAno]       = useState('todos');
  const [fComp,      setFComp]      = useState('todos');
  const [inclDez,    setInclDez]    = useState(false);
  const [busca,      setBusca]      = useState('');
  const [pagina,     setPagina]     = useState(0);
  const [sortBy,     setSortBy]     = useState('score_total');
  const [sortDir,    setSortDir]    = useState('desc');
  const [notas,      setNotas]      = useState({});

  /* ── PRIMEIRO: listaParaCounts (todos filtros EXCETO severidade) ── */
  const listaParaCounts = useMemo(() => {
    let d = OUTLIERS;
    if (!inclDez)       d = d.filter(o => !o.competencia.endsWith('12'));
    if (fMun !== 'todos') d = d.filter(o => o.municipio === fMun);
    if (fUG  !== 'todos') d = d.filter(o => o.ug.trim() === fUG);
    if (fAno !== 'todos') d = d.filter(o => o.competencia.startsWith(fAno));
    if (fComp!== 'todos') d = d.filter(o => o.competencia === fComp);
    if (busca.trim()) {
      const s = busca.toLowerCase();
      d = d.filter(o =>
        o.municipio.toLowerCase().includes(s) ||
        o.descricao.toLowerCase().includes(s) ||
        o.codigo.toLowerCase().includes(s) ||
        o.ug.toLowerCase().includes(s));
    }
    return d;
  }, [inclDez, fMun, fUG, fAno, fComp, busca]);

  /* ── SEGUNDO: counts (para KPI cards) ── */
  const counts = useMemo(() => ({
    total:   listaParaCounts.length,
    critico: listaParaCounts.filter(o => o.severidade === 'critico').length,
    alto:    listaParaCounts.filter(o => o.severidade === 'alto').length,
    medio:   listaParaCounts.filter(o => o.severidade === 'medio').length,
    baixo:   listaParaCounts.filter(o => o.severidade === 'baixo').length,
  }), [listaParaCounts]);

  /* ── TERCEIRO: lista (filtragem com severidade + ordenação) ── */
  const lista = useMemo(() => {
    let d = listaParaCounts;
    if (fSev !== 'todos') d = d.filter(o => o.severidade === fSev);
    return [...d].sort((a, b) => {
      const va = a[sortBy] ?? 0, vb = b[sortBy] ?? 0;
      return sortDir === 'desc' ? vb - va : va - vb;
    });
  }, [listaParaCounts, fSev, sortBy, sortDir]);

  const paginas  = Math.ceil(lista.length / PAGE);
  const paginado = lista.slice(pagina * PAGE, (pagina + 1) * PAGE);
  const sel      = useMemo(() => OUTLIERS.find(o => o.id === selectedId) ?? null, [selectedId]);

  /* ── UGs filtradas pelo município selecionado ── */
  const ugsFiltradas = useMemo(() => {
    let d = OUTLIERS;
    if (fMun !== 'todos') d = d.filter(o => o.municipio === fMun);
    return ['todos', ...[...new Set(d.map(o => o.ug.trim()))].sort()];
  }, [fMun]);

  /* ── handlers ── */
  const ordenar = col => {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
    setPagina(0);
  };
  const limpar = () => {
    setFSev('todos'); setFMun('todos');
    setFUG('todos'); setFAno('todos'); setFComp('todos');
    setBusca(''); setPagina(0);
  };
  const mudarMun = v => { setFMun(v); setFUG('todos'); setPagina(0); };
  const mudarAno = v => { setFAno(v); setFComp('todos'); setPagina(0); };

  /* ── dados dos gráficos ── */
  const distData    = useMemo(() => {
    const base = (inclDez ? DIST_MENSAL : DIST_MENSAL.filter(d => !d.competencia?.endsWith('12')));
    return base.map(d => {
      const m = parseInt((d.competencia || '').slice(-2), 10);
      const ano = (d.competencia || '').slice(0, 4);
      return { ...d, mes_num: m, nome: `${MESES[m] || ''}/${ano.slice(2)}` };
    });
  }, [inclDez]);

  const sazonalData = FATOR_SAZONAL.map(d => ({ nome: MESES[d.mes], fator: d.fator }));

  // Série com mes anterior calculado
  const serieData = useMemo(() => SERIE_TOP1.map((d, i) => ({
    ...d,
    label: fmtComp(d.competencia),
    valor_mes_ant: i > 0 ? SERIE_TOP1[i - 1].valor : null,
  })), []);

  const Th = ({ col, label, right = true, left = false }) => (
    <th
      onClick={() => ordenar(col)}
      className={`py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide
                  cursor-pointer select-none hover:text-indigo-600 transition whitespace-nowrap
                  ${right ? 'text-right' : left ? 'text-left' : 'text-center'}`}>
      <span className="inline-flex items-center gap-1">
        {label}
        {sortBy === col
          ? (sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />)
          : <span className="w-3" />}
      </span>
    </th>
  );

  const filtrosAtivos = fSev !== 'todos' || fMun !== 'todos' ||
    fUG !== 'todos' || fAno !== 'todos' || fComp !== 'todos' || busca.trim();

  /* ══════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800" style={{fontFamily:'Inter,system-ui,sans-serif'}}>

      {/* ── HEADER ─────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-20">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
              <BarChart2 size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-tight">SIDAO</h1>
              <p className="text-xs text-gray-400 leading-tight">Detecção de Outliers · TCE-RJ</p>
            </div>
          </div>

          {/* Toggle Dezembro */}
          <button
            onClick={() => setInclDez(v => !v)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold
                        border transition
                        ${inclDez
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                          : 'bg-amber-50 border-amber-300 text-amber-700'}`}>
            <Snowflake size={13} />
            {inclDez ? 'Dezembro incluído' : 'Excluindo Dezembro'}
            <span className={`w-8 h-4 rounded-full transition-colors relative
                              ${inclDez ? 'bg-indigo-500' : 'bg-amber-400'}`}>
              <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform
                                ${inclDez ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </span>
          </button>

          <div className="text-xs text-gray-400 text-right hidden md:block">
            <span className="font-semibold text-gray-600">{STATS.total_registros.toLocaleString('pt-BR')}</span> registros ·{' '}
            <span className="font-semibold text-gray-600">{STATS.total_municipios}</span> municípios ·{' '}
            <span className="font-semibold text-gray-600">{STATS.total_competencias}</span> competências
          </div>
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto px-6 py-5">

        {/* ── KPIs ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          <KpiCard label="Total Outliers" value={counts.total.toLocaleString('pt-BR')}
            sub={inclDez ? 'todos os meses' : 'excl. dezembro'}
            color="border-indigo-500" icon={AlertTriangle} />
          <KpiCard label="Críticos" value={counts.critico.toLocaleString('pt-BR')}
            sub="investigação urgente" color="border-red-500" icon={AlertTriangle} />
          <KpiCard label="Altos" value={counts.alto.toLocaleString('pt-BR')}
            sub="prioridade elevada" color="border-orange-500" icon={TrendingUp} />
          <KpiCard label="Médios" value={counts.medio.toLocaleString('pt-BR')}
            sub="monitoramento" color="border-amber-400" icon={TrendingUp} />
          <KpiCard label="Baixos" value={counts.baixo.toLocaleString('pt-BR')}
            sub="referência" color="border-blue-400" icon={Info} />
        </div>

        {/* ── ABAS ────────────────────────────────────────── */}
        <div className="flex gap-0 mb-5 bg-white rounded-xl border border-gray-200 shadow-sm p-1 w-fit">
          {[
            ['triagem',      Search,   'Triagem'],
            ['investigacao', Eye,      'Investigação'],
            ['panorama',     BarChart2,'Panorama'],
          ].map(([id, Icon, lb]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition
                          ${tab === id
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}>
              <Icon size={14} />
              {lb}
            </button>
          ))}
        </div>

        {/* ══ TRIAGEM ══════════════════════════════════════ */}
        {tab === 'triagem' && (
          <div className="space-y-4">

            {/* Filtros */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Filter size={14} className="text-indigo-500" />
                <span className="text-sm font-semibold text-gray-700">Filtros</span>
                {filtrosAtivos && (
                  <button onClick={limpar}
                    className="ml-auto text-xs text-red-500 hover:text-red-700 font-medium transition">
                    Limpar filtros
                  </button>
                )}
              </div>

              {/* Linha 1: severidade */}
              <div className="flex flex-wrap gap-2 mb-3">
                {['todos','critico','alto','medio','baixo'].map(s => (
                  <button key={s} onClick={() => { setFSev(s); setPagina(0); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border
                                ${fSev === s
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                  : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'}`}>
                    {s === 'todos' ? 'Todos' : SEV_CFG[s]?.label}
                    {s !== 'todos' && (
                      <span className="ml-1.5 opacity-70">
                        ({counts[s === 'critico' ? 'critico' : s === 'alto' ? 'alto' : s === 'medio' ? 'medio' : 'baixo']})
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Linha 2: dropdowns */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                <Select value={fAno} onChange={mudarAno}>
                  <option value="todos">Todos os Anos</option>
                  {ANOS.filter(a => a !== 'todos').map(a => <option key={a} value={a}>{a}</option>)}
                </Select>

                <Select value={fComp} onChange={v => { setFComp(v); setPagina(0); }}
                  className={fAno === 'todos' ? 'opacity-40 pointer-events-none' : ''}>
                  <option value="todos">Todas as Comp.</option>
                  {(COMPS_MAP[fAno] || []).filter(c => c !== 'todos').map(c =>
                    <option key={c} value={c}>{fmtComp(c)}</option>)}
                </Select>

                <Select value={fMun} onChange={mudarMun}>
                  <option value="todos">Todos os Municípios</option>
                  {MUNICIPIOS.filter(m => m !== 'todos').map(m =>
                    <option key={m} value={m}>{m}</option>)}
                </Select>

                <Select value={fUG} onChange={v => { setFUG(v); setPagina(0); }} className="col-span-1 md:col-span-2">
                  <option value="todos">Todos os Órgãos</option>
                  {ugsFiltradas.filter(u => u !== 'todos').map(u =>
                    <option key={u} value={u}>{u.length > 45 ? u.slice(0,42)+'…' : u}</option>)}
                </Select>
              </div>

              {/* Linha 3: busca */}
              <div className="mt-2 flex items-center gap-2">
                <div className="relative flex-1 max-w-md">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={busca} onChange={e => { setBusca(e.target.value); setPagina(0); }}
                    placeholder="Buscar por município, código, descrição, órgão..."
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg
                               focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400" />
                </div>
                <span className="text-xs text-gray-400 ml-auto">
                  <strong className="text-gray-700">{lista.length.toLocaleString('pt-BR')}</strong> resultados
                </span>
              </div>
            </div>

            {/* Tabela */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <Th col="municipio"    label="Município"  left />
                      <Th col="ug"           label="Órgão"      left />
                      <Th col="codigo"       label="Código"     left />
                      <Th col="descricao"    label="Descrição"  left />
                      <Th col="competencia"  label="Comp."      />
                      <Th col="valor_atual"  label="Valor (R$)" />
                      <Th col="var_simetrica" label="Variação"  />
                      <Th col="score_total"  label="Score"      />
                      <th className="py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">
                        Severidade
                      </th>
                      <th className="py-3 px-3 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginado.map(item => (
                      <tr key={item.id}
                        onClick={() => { setSelectedId(item.id); setTab('investigacao'); }}
                        className={`hover:bg-indigo-50 cursor-pointer transition
                                    ${selectedId === item.id ? 'bg-indigo-50' : ''}`}>
                        <td className="py-2.5 px-3 font-semibold text-gray-800 whitespace-nowrap text-xs">
                          {item.municipio}
                        </td>
                        <td className="py-2.5 px-3 text-gray-500 text-xs max-w-[160px] truncate" title={item.ug}>
                          {item.ug.trim()}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-indigo-600 text-xs font-semibold">
                          {item.codigo}
                        </td>
                        <td className="py-2.5 px-3 text-gray-600 text-xs max-w-[220px] truncate" title={item.descricao}>
                          {item.descricao}
                        </td>
                        <td className="py-2.5 px-3 text-center text-xs text-gray-500 whitespace-nowrap">
                          {fmtComp(item.competencia)}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-mono text-xs whitespace-nowrap font-semibold
                                        ${item.valor_atual < 0 ? 'text-orange-600' : 'text-gray-800'}`}>
                          {fmtBRL(item.valor_atual)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-xs">
                          {item.var_simetrica != null
                            ? <span className={`font-semibold ${item.var_simetrica > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                {item.var_simetrica > 0 ? '+' : ''}{fmtPct(item.var_simetrica)}
                              </span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-md
                            ${item.score_total >= 80 ? 'bg-red-100 text-red-700' :
                              item.score_total >= 60 ? 'bg-orange-100 text-orange-700' :
                              item.score_total >= 40 ? 'bg-amber-100 text-amber-700' :
                                                       'bg-blue-100 text-blue-700'}`}>
                            {item.score_total.toFixed(0)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge sev={item.severidade} />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <Eye size={14} className="text-indigo-400 mx-auto" />
                        </td>
                      </tr>
                    ))}
                    {paginado.length === 0 && (
                      <tr>
                        <td colSpan={10} className="text-center py-12 text-gray-400">
                          <Search size={24} className="mx-auto mb-2 opacity-30" />
                          Nenhum resultado para os filtros selecionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              {paginas > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                  <span className="text-xs text-gray-500">
                    Página <strong>{pagina + 1}</strong> de <strong>{paginas}</strong> ·{' '}
                    {lista.length.toLocaleString('pt-BR')} registros
                  </span>
                  <div className="flex items-center gap-1">
                    {[
                      [ChevronsLeft, () => setPagina(0),           pagina === 0],
                      [ChevronLeft,  () => setPagina(p => p - 1),  pagina === 0],
                      [ChevronRight, () => setPagina(p => p + 1),  pagina >= paginas - 1],
                      [ChevronsRight,() => setPagina(paginas - 1), pagina >= paginas - 1],
                    ].map(([Icon, fn, dis], i) => (
                      <button key={i} onClick={fn} disabled={dis}
                        className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-500
                                   hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200
                                   disabled:opacity-30 disabled:cursor-not-allowed transition">
                        <Icon size={14} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ INVESTIGAÇÃO ═════════════════════════════════ */}
        {tab === 'investigacao' && (
          <div className="space-y-4">
            {!sel ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-16 text-center">
                <Eye size={36} className="mx-auto mb-3 text-gray-200" />
                <p className="text-gray-400 text-sm">
                  Selecione um registro na aba <strong className="text-indigo-600">Triagem</strong> para investigar.
                </p>
              </div>
            ) : (
              <>
                {/* Cabeçalho do registro */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <div className="flex flex-wrap justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge sev={sel.severidade} />
                        <span className="text-xs text-gray-400">Score: <strong className="text-gray-700">{sel.score_total.toFixed(0)}/100</strong></span>
                        <span className="text-xs text-gray-400">· Comp: <strong className="text-gray-700">{fmtComp(sel.competencia)}</strong></span>
                      </div>
                      <h2 className="text-xl font-bold text-gray-900">{sel.municipio}</h2>
                      <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                        <Building2 size={13} /> {sel.ug.trim()}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        <span className="font-mono text-indigo-600 font-semibold">{sel.codigo}</span>
                        {' · '}{sel.descricao}
                      </p>
                      {sel.diagnostico && (
                        <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg text-xs text-amber-800">
                          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                          {sel.diagnostico}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-3xl font-bold ${sel.valor_atual < 0 ? 'text-orange-600' : 'text-gray-900'}`}>
                        {fmtBRL(sel.valor_atual)}
                      </div>
                      {sel.valor_anterior != null && (
                        <div className="text-xs text-gray-400 mt-1">
                          Mês anterior: <strong className="text-gray-600">{fmtBRL(sel.valor_anterior)}</strong>
                        </div>
                      )}
                      {sel.var_simetrica != null && (
                        <div className={`text-base font-bold mt-1 ${sel.var_simetrica > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                          {sel.var_simetrica > 0 ? '▲' : '▼'} {Math.abs(sel.var_simetrica * 100).toFixed(1)}%
                          <span className="text-xs font-normal text-gray-400 ml-1">var. simétrica</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Score + Flags */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                    <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                      <TrendingUp size={15} className="text-indigo-500" />
                      Composição do Score
                    </h3>
                    {[
                      { label:'Materialidade (35%)', val:sel.score_mat,
                        tip:'Valor absoluto versus P95 do conjunto', color:'#6366f1' },
                      { label:'Variação (30%)',       val:sel.score_var,
                        tip:'Variação simétrica frente à competência anterior', color:'#10b981' },
                      { label:'Desvio Estatístico (25%)', val:sel.score_est,
                        tip:'Sinalização por IQR e/ou Quantis (MAD-score)', color:'#8b5cf6' },
                      { label:'Sazonalidade (10%)',   val:sel.score_sazonal,
                        tip:`Fator do mês ${fmtComp(sel.competencia).slice(0,2)}: ${sel.fator_sazonal.toFixed(3)}×`, color:'#f59e0b' },
                    ].map(c => (
                      <div key={c.label} className="mb-3" title={c.tip}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">{c.label}</span>
                          <span className="font-bold text-gray-800">{c.val.toFixed(0)}</span>
                        </div>
                        <div className="bg-gray-100 rounded-full h-2.5 overflow-hidden">
                          <div className="h-2.5 rounded-full transition-all"
                            style={{ width:`${Math.min(100,c.val)}%`, backgroundColor:c.color }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                    <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                      <AlertTriangle size={15} className="text-amber-500" />
                      Sinalizações Detectadas
                    </h3>
                    <div className="space-y-2">
                      {[
                        { label:'IQR (k = 1,5)',               val:sel.out_iqr },
                        { label:'Quantis (2,5% – 97,5%)',       val:sel.out_q },
                        { label:'Variação mensal &gt; 50% (MoM)', val:sel.out_mom },
                        { label:'Variação anual &gt; 50% (YoY)', val:sel.out_yoy },
                        { label:'Flag temporal',                val:sel.flag_temporal },
                        { label:'Flag estatístico',             val:sel.flag_estatistico },
                      ].map(f => (
                        <div key={f.label}
                          className={`flex justify-between items-center px-3 py-2 rounded-lg text-xs border
                                      ${f.val
                                        ? 'bg-red-50 border-red-100 text-red-700'
                                        : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
                          <span dangerouslySetInnerHTML={{__html: f.label}} />
                          {f.val
                            ? <span className="flex items-center gap-1 font-semibold"><XCircle size={12}/> Sinalizado</span>
                            : <span className="flex items-center gap-1"><CheckCircle size={12} className="text-emerald-500"/> Normal</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Gráfico 1: Histórico + Média 3m */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <h3 className="text-sm font-bold text-gray-700 mb-1 flex items-center gap-2">
                    <BarChart2 size={15} className="text-indigo-500" />
                    Histórico de Valores — Comparação com Média 3 meses
                  </h3>
                  <p className="text-xs text-gray-400 mb-4">
                    ● vermelho = competências sinalizadas como outlier · linha tracejada = média móvel 3m
                  </p>
                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={serieData} margin={{top:4,right:8,left:0,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{fontSize:9,fill:'#9ca3af'}} />
                      <YAxis tick={{fontSize:9,fill:'#9ca3af'}}
                        tickFormatter={v => Math.abs(v)>=1e6?(v/1e6).toFixed(1)+'M':Math.abs(v)>=1e3?(v/1e3).toFixed(0)+'K':v} />
                      <Tooltip {...tooltipStyle} formatter={(v,n)=>[fmtBRL(v),n]} />
                      <Legend wrapperStyle={{fontSize:11}} />
                      <ReferenceLine y={0} stroke="#d1d5db" strokeDasharray="3 3" />
                      {serieData.some(d => d.avg_3m) && (
                        <Line type="monotone" dataKey="avg_3m" stroke="#94a3b8"
                          strokeWidth={1.5} strokeDasharray="5 4" dot={false} name="Média 3m" />
                      )}
                      <Line type="monotone" dataKey="valor" stroke="#6366f1" strokeWidth={2}
                        name="Valor liquidado"
                        dot={({cx,cy,payload}) =>
                          payload.outlier
                            ? <circle key={`d${cx}${cy}`} cx={cx} cy={cy} r={5} fill="#ef4444" stroke="#fff" strokeWidth={1.5}/>
                            : <circle key={`d${cx}${cy}`} cx={cx} cy={cy} r={3} fill="#6366f1"/>}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Gráfico 2: Histórico + Média 6m */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <h3 className="text-sm font-bold text-gray-700 mb-1 flex items-center gap-2">
                    <BarChart2 size={15} className="text-emerald-500" />
                    Histórico de Valores — Comparação com Média 6 meses
                  </h3>
                  <p className="text-xs text-gray-400 mb-4">
                    Janela de 6 meses captura tendências de médio prazo · ● vermelho = outlier
                  </p>
                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={serieData} margin={{top:4,right:8,left:0,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{fontSize:9,fill:'#9ca3af'}} />
                      <YAxis tick={{fontSize:9,fill:'#9ca3af'}}
                        tickFormatter={v => Math.abs(v)>=1e6?(v/1e6).toFixed(1)+'M':Math.abs(v)>=1e3?(v/1e3).toFixed(0)+'K':v} />
                      <Tooltip {...tooltipStyle} formatter={(v,n)=>[fmtBRL(v),n]} />
                      <Legend wrapperStyle={{fontSize:11}} />
                      <ReferenceLine y={0} stroke="#d1d5db" strokeDasharray="3 3" />
                      {serieData.some(d => d.avg_6m) && (
                        <Line type="monotone" dataKey="avg_6m" stroke="#10b981"
                          strokeWidth={1.5} strokeDasharray="5 4" dot={false} name="Média 6m" />
                      )}
                      <Line type="monotone" dataKey="valor" stroke="#6366f1" strokeWidth={2}
                        name="Valor liquidado"
                        dot={({cx,cy,payload}) =>
                          payload.outlier
                            ? <circle key={`e${cx}${cy}`} cx={cx} cy={cy} r={5} fill="#ef4444" stroke="#fff" strokeWidth={1.5}/>
                            : <circle key={`e${cx}${cy}`} cx={cx} cy={cy} r={3} fill="#6366f1"/>}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Gráfico 3: 3 linhas — atual / mês anterior / mesmo mês ano anterior */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <h3 className="text-sm font-bold text-gray-700 mb-1 flex items-center gap-2">
                    <BarChart2 size={15} className="text-rose-500" />
                    Comparativo: Valor Atual × Mês Anterior × Mesmo Mês Ano Anterior
                  </h3>
                  <p className="text-xs text-gray-400 mb-4">
                    Permite identificar se o desvio é pontual ou padrão histórico recorrente
                  </p>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={serieData} margin={{top:4,right:8,left:0,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{fontSize:9,fill:'#9ca3af'}} />
                      <YAxis tick={{fontSize:9,fill:'#9ca3af'}}
                        tickFormatter={v => Math.abs(v)>=1e6?(v/1e6).toFixed(1)+'M':Math.abs(v)>=1e3?(v/1e3).toFixed(0)+'K':v} />
                      <Tooltip {...tooltipStyle} formatter={(v,n)=>[fmtBRL(v),n]} />
                      <Legend wrapperStyle={{fontSize:11}} />
                      <ReferenceLine y={0} stroke="#d1d5db" strokeDasharray="3 3" />
                      <Line type="monotone" dataKey="valor" stroke="#6366f1" strokeWidth={2.5}
                        dot={({cx,cy,payload}) =>
                          payload.outlier
                            ? <circle key={`f${cx}${cy}`} cx={cx} cy={cy} r={5} fill="#ef4444" stroke="#fff" strokeWidth={1.5}/>
                            : <circle key={`f${cx}${cy}`} cx={cx} cy={cy} r={2.5} fill="#6366f1"/>}
                        name="Valor atual" />
                      <Line type="monotone" dataKey="valor_mes_ant" stroke="#f97316" strokeWidth={1.5}
                        strokeDasharray="6 3" dot={false} name="Mês anterior" connectNulls />
                      {serieData.some(d => d.valor_ano_anterior != null) && (
                        <Line type="monotone" dataKey="valor_ano_anterior" stroke="#10b981" strokeWidth={1.5}
                          strokeDasharray="3 3" dot={false} name="Mesmo mês ano ant." connectNulls />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Anotações */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <FileText size={15} className="text-gray-400" />
                    Anotações do Auditor
                  </h3>
                  <textarea
                    value={notas[sel.id] || ''}
                    onChange={e => setNotas({ ...notas, [sel.id]: e.target.value })}
                    placeholder="Registre observações, hipóteses, diligências solicitadas, encaminhamentos..."
                    className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-700
                               placeholder-gray-300 focus:outline-none focus:ring-2
                               focus:ring-indigo-300 focus:border-indigo-400 resize-none bg-gray-50"
                    rows={4}
                  />
                  {notas[sel.id] && (
                    <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                      <CheckCircle size={11}/> Anotação salva na sessão
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ PANORAMA ═════════════════════════════════════ */}
        {tab === 'panorama' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Outliers por mês */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 className="text-sm font-bold text-gray-700 mb-1">Distribuição de Outliers por Mês</h3>
                <p className="text-xs text-gray-400 mb-4">
                  {inclDez
                    ? 'Dezembro concentra empenhos de encerramento do exercício fiscal'
                    : 'Dezembro excluído · análise dos demais meses do exercício'}
                </p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={distData} margin={{top:4,right:4,left:0,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="nome" tick={{fontSize:10,fill:'#9ca3af'}} />
                    <YAxis tick={{fontSize:10,fill:'#9ca3af'}} />
                    <Tooltip {...tooltipStyle} formatter={v=>[v,'Outliers']} />
                    <Bar dataKey="outliers" name="Outliers" fill="#6366f1" radius={[4,4,0,0]}
                      label={{position:'top',fontSize:8,fill:'#9ca3af'}} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Fator sazonal */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 className="text-sm font-bold text-gray-700 mb-1">Fator Sazonal Calculado por Mês</h3>
                <p className="text-xs text-gray-400 mb-4">
                  Dezembro = 2,84× · calculado sobre 221.594 registros · referência = 1,0
                </p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={sazonalData} margin={{top:4,right:4,left:0,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="nome" tick={{fontSize:10,fill:'#9ca3af'}} />
                    <YAxis tick={{fontSize:10,fill:'#9ca3af'}} domain={[0,3.2]} />
                    <Tooltip {...tooltipStyle} formatter={v=>[v.toFixed(3)+'×','Fator']} />
                    <ReferenceLine y={1} stroke="#d1d5db" strokeDasharray="4 3"
                      label={{value:'base',fill:'#9ca3af',fontSize:9}} />
                    <Bar dataKey="fator" name="Fator sazonal" fill="#8b5cf6" radius={[4,4,0,0]}
                      label={{position:'top',fontSize:8,fill:'#9ca3af',formatter:v=>v.toFixed(2)}} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top municípios críticos */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <Map size={15} className="text-red-500" />
                Municípios com Mais Outliers Críticos
              </h3>
              {(() => {
                const ag = {};
                listaParaCounts.filter(o => o.severidade === 'critico')
                  .forEach(o => { ag[o.municipio] = (ag[o.municipio]||0)+1; });
                const sorted = Object.entries(ag).sort((a,b)=>b[1]-a[1]).slice(0,12);
                const max = sorted[0]?.[1] || 1;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-3">
                    {sorted.map(([mun, cnt]) => (
                      <div key={mun} className="flex items-center gap-3">
                        <button
                          onClick={() => { setFSev('critico'); setFMun(mun); setTab('triagem'); }}
                          className="text-xs text-indigo-600 hover:underline w-36 truncate text-left font-medium" title={mun}>
                          {mun}
                        </button>
                        <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                          <div className="h-3 rounded-full bg-red-500 transition-all"
                            style={{width:`${(cnt/max*100).toFixed(0)}%`}} />
                        </div>
                        <span className="text-xs font-bold text-red-600 w-6 text-right">{cnt}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <p className="text-xs text-gray-400 mt-4">Clique no município para filtrar na Triagem.</p>
            </div>

            {/* Resumo estatístico */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-4">Resumo da Base Analisada</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label:'Municípios',              val:STATS.total_municipios },
                  { label:'Órgãos (UG)',              val:STATS.total_ugs },
                  { label:'Códigos de Despesa',       val:STATS.total_codigos },
                  { label:'Competências analisadas',  val:STATS.total_competencias },
                ].map(s => (
                  <div key={s.label} className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-indigo-600">{s.val.toLocaleString('pt-BR')}</div>
                    <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-xs text-gray-600">
                <div className="bg-gray-50 rounded-lg p-3">
                  <span className="font-semibold text-gray-800">9,89%</span> dos registros são outliers (lógica OR)
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <span className="font-semibold text-gray-800">6,05%</span> dos valores são negativos (estornos)
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  Kurtosis = <span className="font-semibold text-gray-800">524</span> · distribuição extremamente leptocúrtica
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Footer */}
      <footer className="max-w-screen-2xl mx-auto px-6 py-4 mt-4 border-t border-gray-200 flex justify-between items-center">
        <span className="text-xs text-gray-400">SIDAO · TCE-RJ · Dados reais extraídos de BaseSidao.csv</span>
        <span className="text-xs text-gray-300">
          {inclDez ? '⚠ Dezembro incluído na análise' : '✓ Dezembro excluído (padrão)'}
        </span>
      </footer>
    </div>
  );
}

/* ████████████████████ LOGIN ████████████████████ */
const SESSION_KEY = 'sidao_auth';

function LoginScreen({ onLogin }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = e => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      if (user === 'admin' && pass === 'admin') {
        sessionStorage.setItem(SESSION_KEY, '1');
        onLogin();
      } else {
        setError('Usuário ou senha incorretos.');
        setLoading(false);
      }
    }, 600);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-indigo-800 to-indigo-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">SIDAO</h1>
          <p className="text-sm text-gray-500 mt-1">TCE-RJ · Detecção de Outliers</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Usuário</label>
            <input
              type="text" value={user} onChange={e => setUser(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="usuário" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Senha</label>
            <input
              type="password" value={pass} onChange={e => setPass(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="senha" />
          </div>
          {error && <p className="text-xs text-red-500 text-center">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-60">
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1');
  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />;
  return <SIDAO />;
}