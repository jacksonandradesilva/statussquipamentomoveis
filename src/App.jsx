import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { hasSupabaseEnv, supabase } from './lib/supabaseClient';

const STORAGE_KEY = 'Status_Mina_Data';

const statusOptions = [
  { value: 'parado', label: 'Parado' },
  { value: 'liberado', label: 'Liberado' },
  { value: 'standby', label: 'Standby' },
  { value: 'aguardandoMaterial', label: 'Aguardando Material' },
  { value: 'EquipamentoEmReforma', label: 'Equipamento em Reforma' }
];

const emptyForm = {
  nome: '',
  status: '',
  causa: '',
  descricao: '',
  horaInicio: '',
  horaFim: ''
};

function formatDateTime(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
}

function fromSupabaseRow(row) {
  return {
    id: row.id,
    nome: row.nome,
    status: row.status,
    causa: row.causa ?? '',
    descricao: row.descricao ?? '',
    horaInicio: row.hora_inicio ?? '',
    horaFim: row.hora_fim ?? '',
    dataHoraCadastro: row.data_hora_cadastro ?? ''
  };
}

function toSupabasePayload(item) {
  return {
    nome: item.nome,
    status: item.status,
    causa: item.causa,
    descricao: item.descricao,
    hora_inicio: item.horaInicio,
    hora_fim: item.horaFim,
    data_hora_cadastro: item.dataHoraCadastro
  };
}

function Topo({ statusConexao }) {
  return (
    <section className="hero">
      <div>
        <p className="kicker">CENTRO DE CONTROLE OPERACIONAL</p>
        <h1>Status Equipamentos Moveis Mina</h1>
        <p>
          Painel tecnico para monitoramento de disponibilidade, manutencao e desempenho dos
          equipamentos moveis.
        </p>
        <span className="badge">{statusConexao}</span>
      </div>
      <div className="hero-brand">
        <img src="/stratos.png" alt="Slogan da Stratos" />
        <p>Stratos: compromisso com disponibilidade, seguranca e performance operacional.</p>
      </div>
    </section>
  );
}

function Navegacao() {
  return (
    <nav className="nav-tabs" aria-label="Navegacao do painel">
      <Link to="/dashboard" className="tab-link">
        Dashboard
      </Link>
      <Link to="/" className="tab-link">
        Painel de Registros
      </Link>
      <Link to="/status" className="tab-link">
        Status dos Equipamentos
      </Link>
    </nav>
  );
}

export default function App() {
  const [equipamentos, setEquipamentos] = useState([]);
  const [formData, setFormData] = useState(emptyForm);
  const [editandoId, setEditandoId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  const statusConexao = useMemo(() => {
    if (hasSupabaseEnv) {
      return 'Conectado ao Supabase';
    }

    return 'Modo local (sem Supabase configurado)';
  }, []);

  const dashboard = useMemo(() => {
    const total = equipamentos.length;
    const parados = equipamentos.filter((item) => item.status === 'parado').length;
    const liberados = equipamentos.filter((item) => item.status === 'liberado').length;

    return {
      total,
      parados,
      liberados,
      taxaParados: total > 0 ? Math.round((parados / total) * 100) : 0,
      taxaLiberados: total > 0 ? Math.round((liberados / total) * 100) : 0
    };
  }, [equipamentos]);

  useEffect(() => {
    void carregarDados();
  }, []);

  async function carregarDados() {
    setLoading(true);
    setErro('');

    if (hasSupabaseEnv) {
      const { data, error } = await supabase
        .from('equipamentos_mina')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        setErro('Falha ao carregar no Supabase. Exibindo dados locais.');
        carregarDadosLocais();
      } else {
        setEquipamentos((data ?? []).map(fromSupabaseRow));
      }

      setLoading(false);
      return;
    }

    carregarDadosLocais();
    setLoading(false);
  }

  function carregarDadosLocais() {
    const dadosSalvos = localStorage.getItem(STORAGE_KEY);

    if (!dadosSalvos) {
      setEquipamentos([]);
      return;
    }

    try {
      const dados = JSON.parse(dadosSalvos);
      const lista = Array.isArray(dados) ? dados : dados.equipamentos ?? [];
      setEquipamentos(lista);
    } catch {
      setEquipamentos([]);
    }
  }

  function salvarLocal(lista) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
  }

  function onInputChange(event) {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function limparFormulario() {
    setFormData(emptyForm);
    setEditandoId(null);
  }

  async function onSubmit(event) {
    event.preventDefault();
    setMensagem('');
    setErro('');

    if (!formData.nome.trim() || !formData.status) {
      return;
    }

    const now = formatDateTime(new Date());
    const equipamentoPayload = {
      nome: formData.nome.trim(),
      status: formData.status,
      causa: formData.causa.trim(),
      descricao: formData.descricao.trim(),
      horaInicio: formData.horaInicio,
      horaFim: formData.horaFim,
      dataHoraCadastro: now
    };

    if (hasSupabaseEnv) {
      if (editandoId === null) {
        const { error } = await supabase
          .from('equipamentos_mina')
          .insert(toSupabasePayload(equipamentoPayload));

        if (error) {
          setErro('Erro ao cadastrar no Supabase.');
          return;
        }

        setMensagem('Equipamento cadastrado com sucesso.');
      } else {
        const { error } = await supabase
          .from('equipamentos_mina')
          .update(toSupabasePayload(equipamentoPayload))
          .eq('id', editandoId);

        if (error) {
          setErro('Erro ao atualizar no Supabase.');
          return;
        }

        setMensagem('Equipamento atualizado com sucesso.');
      }

      limparFormulario();
      await carregarDados();
      return;
    }

    if (editandoId === null) {
      const nextId =
        equipamentos.length > 0
          ? Math.max(...equipamentos.map((item) => Number(item.id) || 0)) + 1
          : 1;
      const novo = { ...equipamentoPayload, id: nextId };
      const lista = [...equipamentos, novo];
      setEquipamentos(lista);
      salvarLocal(lista);
      setMensagem('Equipamento cadastrado localmente.');
    } else {
      const lista = equipamentos.map((item) =>
        item.id === editandoId ? { ...item, ...equipamentoPayload, id: editandoId } : item
      );
      setEquipamentos(lista);
      salvarLocal(lista);
      setMensagem('Equipamento atualizado localmente.');
    }

    limparFormulario();
  }

  function editarEquipamento(item) {
    setFormData({
      nome: item.nome ?? '',
      status: item.status ?? '',
      causa: item.causa ?? '',
      descricao: item.descricao ?? '',
      horaInicio: item.horaInicio ?? '',
      horaFim: item.horaFim ?? ''
    });
    setEditandoId(item.id);
    setMensagem('');
    setErro('');
  }

  async function excluirEquipamento(itemId) {
    setMensagem('');
    setErro('');

    if (hasSupabaseEnv) {
      const { error } = await supabase.from('equipamentos_mina').delete().eq('id', itemId);

      if (error) {
        setErro('Erro ao excluir no Supabase.');
        return;
      }

      setMensagem('Equipamento excluido com sucesso.');
      await carregarDados();
      return;
    }

    const lista = equipamentos.filter((item) => item.id !== itemId);
    setEquipamentos(lista);
    salvarLocal(lista);
    setMensagem('Equipamento excluido localmente.');
  }

  return (
    <BrowserRouter>
      <main className="app-shell">
        <Topo statusConexao={statusConexao} />
        <Navegacao />

        <Routes>
          <Route
            path="/dashboard"
            element={
              <section className="panel">
                <h2>Dashboard Operacional</h2>
                {loading ? (
                  <p>Carregando indicadores...</p>
                ) : (
                  <>
                    <div className="dash-grid">
                      <article className="dash-card total">
                        <h3>Total de Equipamentos</h3>
                        <p>{dashboard.total}</p>
                      </article>
                      <article className="dash-card stopped">
                        <h3>Equipamentos Parados</h3>
                        <p>{dashboard.parados}</p>
                        <small>{dashboard.taxaParados}% do total</small>
                      </article>
                      <article className="dash-card released">
                        <h3>Equipamentos Liberados</h3>
                        <p>{dashboard.liberados}</p>
                        <small>{dashboard.taxaLiberados}% do total</small>
                      </article>
                    </div>

                    <div className="dash-list">
                      <h3>Parados no momento</h3>
                      {dashboard.parados === 0 ? (
                        <p>Nenhum equipamento parado.</p>
                      ) : (
                        <ul>
                          {equipamentos
                            .filter((item) => item.status === 'parado')
                            .map((item) => (
                              <li key={item.id}>
                                <strong>{item.nome}</strong> - {item.causa || 'Sem causa informada'}
                              </li>
                            ))}
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </section>
            }
          />
          <Route
            path="/"
            element={
              <section className="panel">
                <h2>Painel de Registros</h2>

                <form className="form-grid" onSubmit={onSubmit}>
                  <label htmlFor="nome">Tag do Equipamento</label>
                  <input
                    id="nome"
                    name="nome"
                    type="text"
                    placeholder="Digite o Tag do equipamento (Ex: 14CR10)"
                    required
                    value={formData.nome}
                    onChange={onInputChange}
                  />

                  <label htmlFor="status">Status</label>
                  <select
                    id="status"
                    name="status"
                    required
                    value={formData.status}
                    onChange={onInputChange}
                  >
                    <option value="" disabled>
                      Selecione o status
                    </option>
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="causa">Equipamento / Causa</label>
                  <input
                    id="causa"
                    name="causa"
                    type="text"
                    placeholder="Equipamento e a causa (se aplicavel)"
                    value={formData.causa}
                    onChange={onInputChange}
                  />

                  <label htmlFor="descricao">Descricao</label>
                  <input
                    id="descricao"
                    name="descricao"
                    type="text"
                    placeholder="Descricao adicional do equipamento"
                    value={formData.descricao}
                    onChange={onInputChange}
                  />

                  <label htmlFor="horaInicio">Horario Inicio</label>
                  <input
                    id="horaInicio"
                    name="horaInicio"
                    type="time"
                    value={formData.horaInicio}
                    onChange={onInputChange}
                  />

                  <label htmlFor="horaFim">Horario Fim</label>
                  <input
                    id="horaFim"
                    name="horaFim"
                    type="time"
                    value={formData.horaFim}
                    onChange={onInputChange}
                  />

                  <div className="actions">
                    <button type="submit">{editandoId === null ? 'Cadastrar' : 'Atualizar'}</button>
                    <button type="button" className="ghost" onClick={limparFormulario}>
                      Limpar
                    </button>
                  </div>
                </form>

                {mensagem && <p className="feedback success">{mensagem}</p>}
                {erro && <p className="feedback error">{erro}</p>}
              </section>
            }
          />
          <Route
            path="/status"
            element={
              <section className="panel">
                <h2>Status Equipamentos Moveis</h2>
                {loading ? (
                  <p>Carregando...</p>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Equipamento</th>
                          <th>Status</th>
                          <th>Causa da Parada</th>
                          <th>Descricao</th>
                          <th>Horario Inicio</th>
                          <th>Horario Fim</th>
                          <th>Data e Hora Cadastro</th>
                          <th>Acoes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {equipamentos.length === 0 ? (
                          <tr>
                            <td colSpan="8">Nenhum registro encontrado.</td>
                          </tr>
                        ) : (
                          equipamentos.map((item) => (
                            <tr key={item.id}>
                              <td>{item.nome}</td>
                              <td>
                                <span className={`status-chip status-${item.status}`}>
                                  {statusOptions.find((option) => option.value === item.status)?.label ?? item.status}
                                </span>
                              </td>
                              <td>{item.causa || '-'}</td>
                              <td>{item.descricao || '-'}</td>
                              <td>{item.horaInicio || '-'}</td>
                              <td>{item.horaFim || '-'}</td>
                              <td>{item.dataHoraCadastro || '-'}</td>
                              <td className="actions-cell">
                                <button className="small" onClick={() => editarEquipamento(item)}>
                                  Editar
                                </button>
                                <button className="small danger" onClick={() => excluirEquipamento(item.id)}>
                                  Excluir
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
