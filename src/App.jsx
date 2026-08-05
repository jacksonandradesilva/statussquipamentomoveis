import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { hasSupabaseEnv, supabase } from './lib/supabaseClient';

const STORAGE_KEY = 'Status_Mina_Data';
const JPS_STORAGE_KEY = 'Status_Mina_JPs_Data';
const RELATORIO_STORAGE_KEY = 'Relatorio_Diario_Turnos';
const ADMIN_EMAILS = ['jacksonandradesilva33@gmail.com', 'jacksonandradesilva33@gmail'];
const ADMIN_CONTACT_EMAIL = 'jacksonandradesilva33@gmail.com';
const DEFAULT_PAGE_ACCESS = {
  dashboard: true,
  registros: false,
  jpsCadastro: false,
  jpsStatus: false,
  jpsStatusPrevisto: false,
  status: false,
  statusPrevisto: false,
  relatorios: false
};
const DEFAULT_STATUS_ACTIONS = {
  editar: false,
  excluir: false
};

const statusOptions = [
  { value: 'parado', label: 'Parado' },
  { value: 'liberado', label: 'Liberado' },
  { value: 'standby', label: 'Standby' },
  { value: 'aguardandoMaterial', label: 'Aguardando Material' },
  { value: 'faltaMaoDeObra', label: 'Falta de Mao de Obra' },
  { value: 'EquipamentoEmReforma', label: 'Equipamento em Reforma' }
];

const turnoOptions = ['A', 'B', 'C', 'D'];
const turmaOptions = ['A', 'B', 'C', 'D', 'E'];

const emptyForm = {
  nome: '',
  status: '',
  causa: '',
  descricao: '',
  horaInicio: '',
  horaFim: '',
  previsaoLiberacao: '',
  quantidadeDias: ''
};

const emptyRelatorioForm = {
  dataReferencia: '',
  turno: 'A',
  turma: 'A',
  horaInicio: '',
  horaFim: '',
  supervisao: '',
  liderTecnico: '',
  resumo: ''
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

function formatDateOnly(dateText) {
  if (!dateText) {
    return '-';
  }

  const [year, month, day] = dateText.split('-');

  if (!year || !month || !day) {
    return dateText;
  }

  return `${day}/${month}/${year}`;
}

function parseDateValue(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(`${year}-${month}-${day}T00:00:00`);
  }

  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return new Date(`${year}-${month}-${day}T00:00:00`);
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function calcularQuantidadeDias(dataCadastro, previsaoLiberacao) {
  const dataCadastroParsed = parseDateValue(dataCadastro);
  const previsaoParsed = parseDateValue(previsaoLiberacao);

  if (!dataCadastroParsed || !previsaoParsed) {
    return '';
  }

  const diffDays = Math.round((previsaoParsed.getTime() - dataCadastroParsed.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 ? diffDays : '';
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
    previsaoLiberacao: row.previsao_liberacao ?? '',
    quantidadeDias: row.quantidade_dias ?? calcularQuantidadeDias(row.data_hora_cadastro, row.previsao_liberacao),
    dataHoraCadastro: row.data_hora_cadastro ?? ''
  };
}

function toSupabasePayload(item) {
  const previsaoLiberacao =
    typeof item.previsaoLiberacao === 'string' && item.previsaoLiberacao.trim() === ''
      ? null
      : item.previsaoLiberacao;

  return {
    nome: item.nome,
    status: item.status,
    causa: item.causa,
    descricao: item.descricao,
    hora_inicio: item.horaInicio,
    hora_fim: item.horaFim,
    previsao_liberacao: previsaoLiberacao,
    quantidade_dias: item.quantidadeDias === '' || item.quantidadeDias == null ? null : Number(item.quantidadeDias),
    data_hora_cadastro: item.dataHoraCadastro
  };
}

function fromSupabaseRelatorioRow(row) {
  return {
    id: row.id,
    dataReferencia: row.data_referencia ?? '',
    turno: row.turno ?? 'A',
    turma: row.turma ?? 'A',
    horaInicio: row.hora_inicio ?? '',
    horaFim: row.hora_fim ?? '',
    supervisao: row.supervisao ?? '',
    liderTecnico: row.lider_tecnico ?? '',
    resumo: row.resumo ?? '',
    criadoEm: row.criado_em ?? ''
  };
}

function toSupabaseRelatorioPayload(item) {
  return {
    data_referencia: item.dataReferencia,
    turno: item.turno,
    turma: item.turma,
    hora_inicio: item.horaInicio,
    hora_fim: item.horaFim,
    supervisao: item.supervisao,
    lider_tecnico: item.liderTecnico,
    resumo: item.resumo
  };
}

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

function resolveEquipamentoStatus(status, horaFim) {
  return horaFim ? 'liberado' : status;
}

function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(normalizeEmail(email));
}

function getAdminAccess() {
  return {
    dashboard: true,
    registros: true,
    jpsCadastro: true,
    jpsStatus: true,
    jpsStatusPrevisto: true,
    status: true,
    statusPrevisto: true,
    relatorios: true
  };
}

function getAdminStatusActions() {
  return {
    editar: true,
    excluir: true
  };
}

function fromAcessoRowToPageAccess(row) {
  return {
    dashboard: Boolean(row?.acesso_dashboard),
    registros: Boolean(row?.acesso_registros),
    jpsCadastro: Boolean(row?.acesso_jps_cadastro),
    jpsStatus: Boolean(row?.acesso_jps_status),
    jpsStatusPrevisto: Boolean(row?.acesso_jps_status_previsto),
    status: Boolean(row?.acesso_status),
    statusPrevisto: Boolean(row?.acesso_status_previsto),
    relatorios: Boolean(row?.acesso_relatorios)
  };
}

function fromAcessoRowToStatusActions(row) {
  return {
    editar: Boolean(row?.pode_editar_status),
    excluir: Boolean(row?.pode_excluir_status)
  };
}

function getLandingPath(pageAccess, statusActions, isAdmin) {
  if (isAdmin) {
    return '/dashboard';
  }

  if (pageAccess.registros) {
    return '/';
  }

  if (statusActions?.editar || statusActions?.excluir) {
    return '/';
  }

  if (pageAccess.dashboard) {
    return '/dashboard';
  }

  if (pageAccess.jpsCadastro) {
    return '/jps-cadastro';
  }

  if (pageAccess.status) {
    return '/status';
  }

  if (pageAccess.jpsStatus) {
    return '/jps-status';
  }

  if (pageAccess.jpsStatusPrevisto) {
    return '/jps-status-previsto';
  }

  if (pageAccess.statusPrevisto) {
    return '/status-previsto';
  }

  if (pageAccess.relatorios) {
    return '/relatorios';
  }

  return '/sem-acesso';
}

function Topo({ currentUserEmail }) {
  return (
    <section className="hero">
      <div>
        <h1>Status Equipamentos Moveis Mina</h1>
        <p className="welcome-text">Seja bem-vindo, {currentUserEmail}.</p>
      </div>
      <div className="hero-side">
        <img src="/stratos.png" alt="Slogan da Stratos" />
      </div>
    </section>
  );
}

function Navegacao({ onLogout, isAdmin, pageAccess }) {
  return (
    <nav className="nav-tabs" aria-label="Navegacao do painel">
      {(isAdmin || pageAccess.dashboard) && (
        <Link to="/dashboard" className="tab-link">
          Dashboard
        </Link>
      )}
      {(isAdmin || pageAccess.registros) && (
        <Link to="/" className="tab-link">
          Painel de Registros
        </Link>
      )}
      {(isAdmin || pageAccess.jpsCadastro) && (
        <Link to="/jps-cadastro" className="tab-link">
          Cadastro de JPs
        </Link>
      )}
      {(isAdmin || pageAccess.status) && (
        <Link to="/status" className="tab-link">
          Status dos Equipamentos
        </Link>
      )}
      {(isAdmin || pageAccess.jpsStatus) && (
        <Link to="/jps-status" className="tab-link">
          Status de JPs
        </Link>
      )}
      {(isAdmin || pageAccess.jpsStatusPrevisto) && (
        <Link to="/jps-status-previsto" className="tab-link">
          Previsao de JPs
        </Link>
      )}
      {(isAdmin || pageAccess.statusPrevisto) && (
        <Link to="/status-previsto" className="tab-link">
          Previsao Maquinas
        </Link>
      )}
      {(isAdmin || pageAccess.relatorios) && (
        <Link to="/relatorios" className="tab-link">
          Relatorio Diario
        </Link>
      )}
      {isAdmin && (
        <Link to="/admin" className="tab-link">
          Admin
        </Link>
      )}
      <button type="button" className="tab-link logout-link" onClick={onLogout}>
        Sair
      </button>
    </nav>
  );
}

function LoginPage({ onLogin, notice }) {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loadingLogin, setLoadingLogin] = useState(false);

  async function onSubmitLogin(event) {
    event.preventDefault();
    setLoadingLogin(true);
    const erroLogin = await onLogin(usuario, senha);
    setLoadingLogin(false);

    if (erroLogin) {
      setErro(erroLogin);
      return;
    }

    setErro('');
    navigate('/dashboard', { replace: true });
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand">
          <img src="/stratos.png" alt="Slogan da Stratos" />
        </div>
        <h1>Status Equipamentos Moveis</h1>
        <p>Informe email (login) e senha para acessar o sistema.</p>

        <form className="auth-form" onSubmit={onSubmitLogin}>
          <label htmlFor="usuario">Email (Login)</label>
          <input
            id="usuario"
            name="usuario"
            type="email"
            placeholder="Digite seu email"
            value={usuario}
            onChange={(event) => setUsuario(event.target.value)}
            required
          />

          <label htmlFor="senha">Senha</label>
          <input
            id="senha"
            name="senha"
            type="password"
            placeholder="Digite sua senha"
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
            required
          />

          <button type="submit" disabled={loadingLogin}>
            {loadingLogin ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="feedback">
          Primeiro acesso: apos o cadastro, confirme o email recebido e aguarde a liberacao do administrador
          ({ADMIN_CONTACT_EMAIL}).
        </p>
        <button type="button" className="link-button" onClick={() => navigate('/cadastro')}>
          Cadastrar novo usuario
        </button>

        {notice && <p className="feedback error">{notice}</p>}
        {erro && <p className="feedback error">{erro}</p>}
      </section>
    </main>
  );
}

function CadastroPage({ onRegister }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [loadingCadastro, setLoadingCadastro] = useState(false);

  async function onSubmitCadastro(event) {
    event.preventDefault();
    setErro('');
    setMensagem('');

    if (senha !== confirmacao) {
      setErro('As senhas nao conferem.');
      return;
    }

    setLoadingCadastro(true);
    const retorno = await onRegister(email, senha);
    setLoadingCadastro(false);

    if (retorno.ok) {
      setMensagem(retorno.message);
      setEmail('');
      setSenha('');
      setConfirmacao('');
      return;
    }

    setErro(retorno.message);
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand">
          <img src="/stratos.png" alt="Slogan da Stratos" />
        </div>
        <h1>Cadastrar novo usuario</h1>
        <p>Informe email e senha. O Supabase enviara um email de confirmacao automaticamente.</p>

        <form className="auth-form" onSubmit={onSubmitCadastro}>
          <label htmlFor="cadastroEmail">Email</label>
          <input
            id="cadastroEmail"
            name="cadastroEmail"
            type="email"
            placeholder="Digite o email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="cadastroSenha">Senha</label>
          <input
            id="cadastroSenha"
            name="cadastroSenha"
            type="password"
            placeholder="Crie uma senha"
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
            required
            minLength={6}
          />

          <label htmlFor="cadastroConfirmacao">Confirmar senha</label>
          <input
            id="cadastroConfirmacao"
            name="cadastroConfirmacao"
            type="password"
            placeholder="Repita a senha"
            value={confirmacao}
            onChange={(event) => setConfirmacao(event.target.value)}
            required
            minLength={6}
          />

          <div className="actions">
            <button type="submit" disabled={loadingCadastro}>
              {loadingCadastro ? 'Cadastrando...' : 'Cadastrar'}
            </button>
            <button type="button" className="ghost" onClick={() => navigate('/login')}>
              Voltar ao login
            </button>
          </div>
        </form>

        {mensagem && <p className="feedback success">{mensagem}</p>}
        {erro && <p className="feedback error">{erro}</p>}
      </section>
    </main>
  );
}

function AdminPage({ currentUserEmail, onRegistrarHistorico }) {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [permissoesDraft, setPermissoesDraft] = useState({});
  const [loadingSolicitacoes, setLoadingSolicitacoes] = useState(true);
  const [erroSolicitacoes, setErroSolicitacoes] = useState('');
  const [mensagemSolicitacoes, setMensagemSolicitacoes] = useState('');
  const [processandoId, setProcessandoId] = useState(null);

  useEffect(() => {
    void carregarSolicitacoes();
  }, []);

  async function carregarSolicitacoes() {
    if (!hasSupabaseEnv || !supabase) {
      setErroSolicitacoes('Supabase nao configurado.');
      setLoadingSolicitacoes(false);
      return;
    }

    setLoadingSolicitacoes(true);
    setErroSolicitacoes('');

    const { data, error } = await supabase
      .from('acessos_sistema')
      .select(
        'id, email, status, solicitado_em, liberado_em, liberado_por, acesso_dashboard, acesso_registros, acesso_jps_cadastro, acesso_jps_status, acesso_jps_status_previsto, acesso_status, acesso_status_previsto, acesso_relatorios, pode_editar_status, pode_excluir_status'
      )
      .order('solicitado_em', { ascending: false });

    if (error) {
      setErroSolicitacoes(`Falha ao carregar acessos: ${error.message}`);
      setSolicitacoes([]);
      setPermissoesDraft({});
      setLoadingSolicitacoes(false);
      return;
    }

    const lista = data ?? [];
    setSolicitacoes(lista);

    const nextDraft = {};
    lista.forEach((item) => {
      nextDraft[item.id] = {
        acesso_dashboard: Boolean(item.acesso_dashboard),
        acesso_registros: Boolean(item.acesso_registros),
        acesso_jps_cadastro: Boolean(item.acesso_jps_cadastro),
        acesso_jps_status: Boolean(item.acesso_jps_status),
        acesso_jps_status_previsto: Boolean(item.acesso_jps_status_previsto),
        acesso_status: Boolean(item.acesso_status),
        acesso_status_previsto: Boolean(item.acesso_status_previsto),
        acesso_relatorios: Boolean(item.acesso_relatorios),
        pode_editar_status: Boolean(item.pode_editar_status),
        pode_excluir_status: Boolean(item.pode_excluir_status)
      };
    });
    setPermissoesDraft(nextDraft);
    setLoadingSolicitacoes(false);
  }

  async function atualizarStatusAcesso(item, novoStatus) {
    if (!hasSupabaseEnv || !supabase) {
      setErroSolicitacoes('Supabase nao configurado.');
      return;
    }

    setProcessandoId(item.id);
    setMensagemSolicitacoes('');
    setErroSolicitacoes('');

    const payload = {
      status: novoStatus,
      liberado_por: normalizeEmail(currentUserEmail)
    };

    if (novoStatus === 'aprovado') {
      payload.liberado_em = new Date().toISOString();
    } else {
      payload.liberado_em = null;
    }

    const { error } = await supabase.from('acessos_sistema').update(payload).eq('id', item.id);

    if (error) {
      setErroSolicitacoes(`Falha ao atualizar acesso: ${error.message}`);
      setProcessandoId(null);
      return;
    }

    setMensagemSolicitacoes(
      novoStatus === 'aprovado'
        ? `Acesso liberado para ${item.email}.`
        : `Acesso bloqueado para ${item.email}.`
    );
    await onRegistrarHistorico({
      email: currentUserEmail,
      acao: novoStatus === 'aprovado' ? 'liberacao_usuario' : 'bloqueio_usuario',
      detalhes: `Usuario ${item.email} alterado para status ${novoStatus}`
    });
    setProcessandoId(null);
    await carregarSolicitacoes();
  }

  async function excluirCadastro(item) {
    if (!hasSupabaseEnv || !supabase) {
      setErroSolicitacoes('Supabase nao configurado.');
      return;
    }

    if (normalizeEmail(item.email) === normalizeEmail(currentUserEmail)) {
      setErroSolicitacoes('Nao e permitido excluir o proprio usuario administrador.');
      return;
    }

    const confirmou = window.confirm(`Deseja excluir o cadastro de ${item.email}?`);

    if (!confirmou) {
      return;
    }

    setProcessandoId(item.id);
    setMensagemSolicitacoes('');
    setErroSolicitacoes('');

    const { error } = await supabase.from('acessos_sistema').delete().eq('id', item.id);

    if (error) {
      setErroSolicitacoes(`Falha ao excluir cadastro: ${error.message}`);
      setProcessandoId(null);
      return;
    }

    await onRegistrarHistorico({
      email: currentUserEmail,
      acao: 'exclusao_cadastro_acesso',
      detalhes: `Cadastro removido para ${item.email}`
    });

    setMensagemSolicitacoes(`Cadastro excluido para ${item.email}.`);
    setProcessandoId(null);
    await carregarSolicitacoes();
  }

  function onPermissaoChange(itemId, campo, valor) {
    setPermissoesDraft((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] ?? {
          acesso_dashboard: false,
          acesso_registros: false,
          acesso_jps_cadastro: false,
          acesso_jps_status: false,
          acesso_jps_status_previsto: false,
          acesso_status: false,
          acesso_status_previsto: false,
          acesso_relatorios: false,
          pode_editar_status: false,
          pode_excluir_status: false
        }),
        [campo]: valor
      }
    }));
  }

  async function salvarPermissoes(item) {
    if (!hasSupabaseEnv || !supabase) {
      setErroSolicitacoes('Supabase nao configurado.');
      return;
    }

    const draft = permissoesDraft[item.id];

    if (!draft) {
      setErroSolicitacoes('Permissoes nao encontradas para este cadastro.');
      return;
    }

    if (
      !draft.acesso_dashboard &&
      !draft.acesso_registros &&
      !draft.acesso_jps_cadastro &&
      !draft.acesso_jps_status &&
      !draft.acesso_jps_status_previsto &&
      !draft.acesso_status &&
      !draft.acesso_status_previsto &&
      !draft.acesso_relatorios
    ) {
      setErroSolicitacoes('Selecione ao menos uma pagina para acesso.');
      return;
    }

    setProcessandoId(item.id);
    setMensagemSolicitacoes('');
    setErroSolicitacoes('');

    const { error } = await supabase
      .from('acessos_sistema')
      .update({
        acesso_dashboard: draft.acesso_dashboard,
        acesso_registros: draft.acesso_registros,
        acesso_jps_cadastro: draft.acesso_jps_cadastro,
        acesso_jps_status: draft.acesso_jps_status,
        acesso_jps_status_previsto: draft.acesso_jps_status_previsto,
        acesso_status: draft.acesso_status,
        acesso_status_previsto: draft.acesso_status_previsto,
        acesso_relatorios: draft.acesso_relatorios,
        pode_editar_status: draft.pode_editar_status,
        pode_excluir_status: draft.pode_excluir_status,
        liberado_por: normalizeEmail(currentUserEmail)
      })
      .eq('id', item.id);

    if (error) {
      setErroSolicitacoes(`Falha ao salvar permissoes: ${error.message}`);
      setProcessandoId(null);
      return;
    }

    setMensagemSolicitacoes(`Permissoes atualizadas para ${item.email}.`);
    await onRegistrarHistorico({
      email: currentUserEmail,
      acao: 'atualizacao_permissoes',
      detalhes: `Permissoes atualizadas para ${item.email}`
    });
    setProcessandoId(null);
    await carregarSolicitacoes();
  }

  return (
    <section className="panel">
      <h2>Painel Administrativo</h2>
      <p className="admin-badge">Acesso administrativo liberado para: {currentUserEmail}</p>
      <p>Libere cada cadastro e marque quais paginas a pessoa pode acessar.</p>
      <Link to="/admin/historico" className="tab-link">
        Ver historico de acessos e edicoes
      </Link>

      {mensagemSolicitacoes && <p className="feedback success">{mensagemSolicitacoes}</p>}
      {erroSolicitacoes && <p className="feedback error">{erroSolicitacoes}</p>}

      {loadingSolicitacoes ? (
        <p>Carregando solicitacoes...</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Status</th>
                <th>Permissoes de Pagina</th>
                <th>Permissoes no Status</th>
                <th>Solicitado em</th>
                <th>Liberado em</th>
                <th>Liberado por</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {solicitacoes.length === 0 ? (
                <tr>
                  <td colSpan="8">Nenhuma solicitacao encontrada.</td>
                </tr>
              ) : (
                solicitacoes.map((item) => (
                  <tr key={item.id}>
                    <td>{item.email}</td>
                    <td>
                      <span className={`access-chip access-${item.status}`}>{item.status}</span>
                    </td>
                    <td>
                      <div className="page-access-grid">
                        <label>
                          <input
                            type="checkbox"
                            checked={Boolean(permissoesDraft[item.id]?.acesso_dashboard)}
                            onChange={(event) =>
                              onPermissaoChange(item.id, 'acesso_dashboard', event.target.checked)
                            }
                          />
                          Dashboard
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={Boolean(permissoesDraft[item.id]?.acesso_registros)}
                            onChange={(event) =>
                              onPermissaoChange(item.id, 'acesso_registros', event.target.checked)
                            }
                          />
                          Registros
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={Boolean(permissoesDraft[item.id]?.acesso_jps_cadastro)}
                            onChange={(event) =>
                              onPermissaoChange(item.id, 'acesso_jps_cadastro', event.target.checked)
                            }
                          />
                          Cadastro de JPs
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={Boolean(permissoesDraft[item.id]?.acesso_status)}
                            onChange={(event) => onPermissaoChange(item.id, 'acesso_status', event.target.checked)}
                          />
                          Status
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={Boolean(permissoesDraft[item.id]?.acesso_jps_status)}
                            onChange={(event) => onPermissaoChange(item.id, 'acesso_jps_status', event.target.checked)}
                          />
                          Status de JPs
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={Boolean(permissoesDraft[item.id]?.acesso_jps_status_previsto)}
                            onChange={(event) =>
                              onPermissaoChange(item.id, 'acesso_jps_status_previsto', event.target.checked)
                            }
                          />
                          Previsao de JPs
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={Boolean(permissoesDraft[item.id]?.acesso_status_previsto)}
                            onChange={(event) => onPermissaoChange(item.id, 'acesso_status_previsto', event.target.checked)}
                          />
                          Status Previsto
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={Boolean(permissoesDraft[item.id]?.acesso_relatorios)}
                            onChange={(event) => onPermissaoChange(item.id, 'acesso_relatorios', event.target.checked)}
                          />
                          Relatorios
                        </label>
                      </div>
                    </td>
                    <td>
                      <div className="page-access-grid">
                        <label>
                          <input
                            type="checkbox"
                            checked={Boolean(permissoesDraft[item.id]?.pode_editar_status)}
                            onChange={(event) =>
                              onPermissaoChange(item.id, 'pode_editar_status', event.target.checked)
                            }
                          />
                          Editar
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={Boolean(permissoesDraft[item.id]?.pode_excluir_status)}
                            onChange={(event) =>
                              onPermissaoChange(item.id, 'pode_excluir_status', event.target.checked)
                            }
                          />
                          Excluir
                        </label>
                      </div>
                    </td>
                    <td>{item.solicitado_em ? formatDateTime(new Date(item.solicitado_em)) : '-'}</td>
                    <td>{item.liberado_em ? formatDateTime(new Date(item.liberado_em)) : '-'}</td>
                    <td>{item.liberado_por || '-'}</td>
                    <td className="actions-cell">
                      <button
                        className="small ghost"
                        onClick={() => salvarPermissoes(item)}
                        disabled={processandoId === item.id}
                      >
                        Salvar paginas
                      </button>
                      <button
                        className="small"
                        onClick={() => atualizarStatusAcesso(item, 'aprovado')}
                        disabled={processandoId === item.id || item.status === 'aprovado'}
                      >
                        Liberar
                      </button>
                      <button
                        className="small danger"
                        onClick={() => excluirCadastro(item)}
                        disabled={processandoId === item.id}
                      >
                        Excluir usuario
                      </button>
                      <button
                        className="small"
                        onClick={() => atualizarStatusAcesso(item, 'bloqueado')}
                        disabled={processandoId === item.id || item.status === 'bloqueado'}
                      >
                        Bloquear
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
  );
}

function AdminHistoricoPage() {
  const [eventos, setEventos] = useState([]);
  const [loadingEventos, setLoadingEventos] = useState(true);
  const [erroEventos, setErroEventos] = useState('');
  const [mensagemEventos, setMensagemEventos] = useState('');
  const [apagandoHistorico, setApagandoHistorico] = useState(false);

  useEffect(() => {
    void carregarHistorico();
  }, []);

  async function carregarHistorico() {
    if (!hasSupabaseEnv || !supabase) {
      setErroEventos('Supabase nao configurado.');
      setLoadingEventos(false);
      return;
    }

    setLoadingEventos(true);
    setErroEventos('');

    const { data, error } = await supabase
      .from('historico_sistema')
      .select('id, email_usuario, acao, detalhes, criado_em')
      .order('criado_em', { ascending: false });

    if (error) {
      setErroEventos(`Falha ao carregar historico: ${error.message}`);
      setEventos([]);
    } else {
      setEventos(data ?? []);
    }

    setLoadingEventos(false);
  }

  async function apagarTodoHistorico() {
    if (!hasSupabaseEnv || !supabase) {
      setErroEventos('Supabase nao configurado.');
      return;
    }

    const confirmou = window.confirm('Deseja realmente apagar todo o historico de acessos? Esta acao nao pode ser desfeita.');

    if (!confirmou) {
      return;
    }

    setApagandoHistorico(true);
    setErroEventos('');
    setMensagemEventos('');

    const { error } = await supabase.from('historico_sistema').delete().not('id', 'is', null);

    if (error) {
      setErroEventos(`Falha ao apagar historico: ${error.message}`);
      setApagandoHistorico(false);
      return;
    }

    setMensagemEventos('Historico apagado com sucesso.');
    setEventos([]);
    setApagandoHistorico(false);
  }

  return (
    <section className="panel">
      <h2>Historico de Acessos e Edicoes</h2>
      <p>Registros de login, liberacoes e alteracoes realizadas no sistema.</p>
      <div className="actions">
        <button type="button" className="danger" onClick={apagarTodoHistorico} disabled={apagandoHistorico}>
          {apagandoHistorico ? 'Apagando...' : 'Apagar todo historico'}
        </button>
      </div>
      {mensagemEventos && <p className="feedback success">{mensagemEventos}</p>}
      {erroEventos && <p className="feedback error">{erroEventos}</p>}

      {loadingEventos ? (
        <p>Carregando historico...</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data e Hora</th>
                <th>Email</th>
                <th>Acao</th>
                <th>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {eventos.length === 0 ? (
                <tr>
                  <td colSpan="4">Nenhum evento registrado.</td>
                </tr>
              ) : (
                eventos.map((evento) => (
                  <tr key={evento.id}>
                    <td>{evento.criado_em ? formatDateTime(new Date(evento.criado_em)) : '-'}</td>
                    <td>{evento.email_usuario}</td>
                    <td>{evento.acao}</td>
                    <td>{evento.detalhes || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DashboardSection({ loading, dashboard, equipamentos, jpsDashboard, jps }) {
  const previsoes = equipamentos.filter((item) => item.previsaoLiberacao || item.quantidadeDias);
  const prazosNaoConcluidos = equipamentos.filter((item) => item.status !== 'liberado' && !item.previsaoLiberacao && !item.quantidadeDias);
  const equipamentosAguardandoMaterial = equipamentos.filter((item) => item.status === 'aguardandoMaterial');
  const equipamentosFaltaMaoDeObra = equipamentos.filter((item) => item.status === 'faltaMaoDeObra');
  const jpsParados = jps.filter((item) => item.status === 'parado');
  const jpsLiberados = jps.filter((item) => item.status === 'liberado');
  const jpsAguardandoMaterial = jps.filter((item) => item.status === 'aguardandoMaterial');
  const jpsFaltaMaoDeObra = jps.filter((item) => item.status === 'faltaMaoDeObra');
  const jpsSemPrevisao = jps.filter((item) => item.status === 'parado' && !item.previsaoLiberacao && !item.quantidadeDias);

  return (
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
            <article className="dash-card total">
              <h3>Aguardando Material</h3>
              <p>{dashboard.aguardandoPeca}</p>
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
            <article className="dash-card labor">
              <h3>Falta de Mao de Obra</h3>
              <p>{dashboard.faltaMaoDeObra}</p>
            </article>
          </div>

          <div className="dash-grid">
            <article className="dash-card total">
              <h3>Total de JPs</h3>
              <p>{jpsDashboard.total}</p>
            </article>
            <article className="dash-card stopped">
              <h3>JPs Parados</h3>
              <p>{jpsDashboard.parados}</p>
              <small>{jpsDashboard.taxaParados}% do total</small>
            </article>
            <article className="dash-card released">
              <h3>JPs Liberados</h3>
              <p>{jpsDashboard.liberados}</p>
              <small>{jpsDashboard.taxaLiberados}% do total</small>
            </article>
            <article className="dash-card total">
              <h3>JPs Aguardando Material</h3>
              <p>{jpsDashboard.aguardandoPeca}</p>
            </article>
            <article className="dash-card labor">
              <h3>JPs Falta de Mao de Obra</h3>
              <p>{jpsDashboard.faltaMaoDeObra}</p>
            </article>
          </div>

          <div className="dash-list">
            <h3>Equipamentos aguardando material</h3>
            {equipamentosAguardandoMaterial.length === 0 ? (
              <p>Nenhum equipamento aguardando material.</p>
            ) : (
              <ul>
                {equipamentosAguardandoMaterial.map((item) => (
                  <li key={item.id}>
                    <strong>{item.nome}</strong> - Material: {item.descricao || 'Sem descricao do material informada'}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="dash-list">
            <h3>JPs aguardando material</h3>
            {jpsAguardandoMaterial.length === 0 ? (
              <p>Nenhum JP aguardando material.</p>
            ) : (
              <ul>
                {jpsAguardandoMaterial.map((item) => (
                  <li key={item.id}>
                    <strong>{item.nome}</strong> - Material: {item.descricao || 'Sem descricao do material informada'}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="dash-list">
            <h3>Equipamentos falta de mao de obra</h3>
            {equipamentosFaltaMaoDeObra.length === 0 ? (
              <p>Nenhum equipamento em falta de mao de obra.</p>
            ) : (
              <ul>
                {equipamentosFaltaMaoDeObra.map((item) => (
                  <li key={item.id}>
                    <strong>{item.nome}</strong> - Descricao: {item.descricao || 'Sem descricao informada'}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="dash-list">
            <h3>JPs falta de mao de obra</h3>
            {jpsFaltaMaoDeObra.length === 0 ? (
              <p>Nenhum JP em falta de mao de obra.</p>
            ) : (
              <ul>
                {jpsFaltaMaoDeObra.map((item) => (
                  <li key={item.id}>
                    <strong>{item.nome}</strong> - Descricao: {item.descricao || 'Sem descricao informada'}
                  </li>
                ))}
              </ul>
            )}
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

          <div className="dash-list">
            <h3>JPs parados no momento</h3>
            {jpsParados.length === 0 ? (
              <p>Nenhum JP parado.</p>
            ) : (
              <ul>
                {jpsParados.map((item) => (
                  <li key={item.id}>
                    <strong>{item.nome}</strong> - {item.causa || 'Sem causa informada'}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="dash-list">
            <h3>Previsoes de liberacao</h3>
            {previsoes.length === 0 ? (
              <p>Nenhuma previsao cadastrada.</p>
            ) : (
              <ul>
                {previsoes.map((item) => (
                  <li key={item.id}>
                    <strong>{item.nome}</strong> - Previsao:{' '}
                    {item.previsaoLiberacao ? formatDateOnly(item.previsaoLiberacao) : '-'} {'/'} Dias:{' '}
                    {item.quantidadeDias || '-'}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="dash-list">
            <h3>Previsoes de liberacao dos JPs</h3>
            {jps.filter((item) => item.previsaoLiberacao || item.quantidadeDias).length === 0 ? (
              <p>Nenhuma previsao cadastrada.</p>
            ) : (
              <ul>
                {jps
                  .filter((item) => item.previsaoLiberacao || item.quantidadeDias)
                  .map((item) => (
                    <li key={item.id}>
                      <strong>{item.nome}</strong> - Previsao:{' '}
                      {item.previsaoLiberacao ? formatDateOnly(item.previsaoLiberacao) : '-'} {'/'} Dias:{' '}
                      {item.quantidadeDias || '-'}
                    </li>
                  ))}
              </ul>
            )}
          </div>

          <div className="dash-list">
            <h3>Prazos não concluídos</h3>
            {prazosNaoConcluidos.length === 0 ? (
              <p>Nenhum prazo pendente.</p>
            ) : (
              <ul>
                {prazosNaoConcluidos.map((item) => (
                  <li key={item.id}>
                    <strong>{item.nome}</strong> - Sem previsao de liberacao cadastrada.
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="dash-list">
            <h3>Prazos nao concluídos dos JPs</h3>
            {jpsSemPrevisao.length === 0 ? (
              <p>Nenhum prazo pendente.</p>
            ) : (
              <ul>
                {jpsSemPrevisao.map((item) => (
                  <li key={item.id}>
                    <strong>{item.nome}</strong> - Sem previsao de liberacao cadastrada.
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function AppContent({ onLogout, isAdmin, currentUserEmail, pageAccess, statusActions, onRegistrarHistorico }) {
  const navigate = useNavigate();
  const [equipamentos, setEquipamentos] = useState([]);
  const [formData, setFormData] = useState(emptyForm);
  const [editandoId, setEditandoId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [jps, setJps] = useState([]);
  const [jpsFormData, setJpsFormData] = useState(emptyForm);
  const [editandoJpId, setEditandoJpId] = useState(null);
  const [loadingJps, setLoadingJps] = useState(true);
  const [mensagemJps, setMensagemJps] = useState('');
  const [erroJps, setErroJps] = useState('');
  const [relatorios, setRelatorios] = useState([]);
  const [relatorioForm, setRelatorioForm] = useState(emptyRelatorioForm);
  const [relatorioMensagem, setRelatorioMensagem] = useState('');
  const [relatorioErro, setRelatorioErro] = useState('');
  const [filtroTurno, setFiltroTurno] = useState('TODOS');
  const [relatorioSelecionadoId, setRelatorioSelecionadoId] = useState(null);

  const landingPath = getLandingPath(pageAccess, statusActions, isAdmin);

  const dashboard = useMemo(() => {
    const total = equipamentos.length;
    const parados = equipamentos.filter((item) => item.status === 'parado').length;
    const liberados = equipamentos.filter((item) => item.status === 'liberado').length;
    const aguardandoPeca = equipamentos.filter((item) => item.status === 'aguardandoMaterial').length;
    const faltaMaoDeObra = equipamentos.filter((item) => item.status === 'faltaMaoDeObra').length;

    return {
      total,
      parados,
      liberados,
      aguardandoPeca,
      faltaMaoDeObra,
      taxaParados: total > 0 ? Math.round((parados / total) * 100) : 0,
      taxaLiberados: total > 0 ? Math.round((liberados / total) * 100) : 0
    };
  }, [equipamentos]);

  const jpsDashboard = useMemo(() => {
    const total = jps.length;
    const parados = jps.filter((item) => item.status === 'parado').length;
    const liberados = jps.filter((item) => item.status === 'liberado').length;
    const aguardandoPeca = jps.filter((item) => item.status === 'aguardandoMaterial').length;
    const faltaMaoDeObra = jps.filter((item) => item.status === 'faltaMaoDeObra').length;

    return {
      total,
      parados,
      liberados,
      aguardandoPeca,
      faltaMaoDeObra,
      taxaParados: total > 0 ? Math.round((parados / total) * 100) : 0,
      taxaLiberados: total > 0 ? Math.round((liberados / total) * 100) : 0
    };
  }, [jps]);

  const jpsPrevisoes = useMemo(() => jps.filter((item) => item.previsaoLiberacao || item.quantidadeDias), [jps]);

  const jpsPrazosNaoConcluidos = useMemo(
    () => jps.filter((item) => item.status === 'parado' && !item.previsaoLiberacao && !item.quantidadeDias),
    [jps]
  );

  const jpsPrevisaoResumo = useMemo(() => {
    const total = jps.length;
    const comPrevisao = jpsPrevisoes.length;
    const semPrevisao = jps.filter((item) => item.status === 'parado' && !item.previsaoLiberacao && !item.quantidadeDias).length;

    return {
      total,
      comPrevisao,
      semPrevisao,
      taxaComPrevisao: total > 0 ? Math.round((comPrevisao / total) * 100) : 0
    };
  }, [jps, jpsPrevisoes.length]);

  const relatorioResumo = useMemo(() => {
    const total = relatorios.length;
    const ultimo = total > 0 ? relatorios[0] : null;

    return {
      total,
      ultimoTurno: ultimo ? `${ultimo.turno} / Turma ${ultimo.turma}` : '-',
      ultimaAtualizacao: ultimo?.criadoEm ? formatDateTime(new Date(ultimo.criadoEm)) : '-'
    };
  }, [relatorios]);

  const relatoriosFiltrados = useMemo(() => {
    if (filtroTurno === 'TODOS') {
      return relatorios;
    }

    return relatorios.filter((item) => item.turno === filtroTurno);
  }, [relatorios, filtroTurno]);

  const relatorioSelecionado = useMemo(
    () => relatorios.find((item) => item.id === relatorioSelecionadoId) ?? null,
    [relatorios, relatorioSelecionadoId]
  );

  const equipamentosPrevisoes = useMemo(
    () => equipamentos.filter((item) => item.previsaoLiberacao || item.quantidadeDias),
    [equipamentos]
  );

  const equipamentosPrazosNaoConcluidos = useMemo(
    () => equipamentos.filter((item) => item.status !== 'liberado' && !item.previsaoLiberacao && !item.quantidadeDias),
    [equipamentos]
  );

  const equipamentosPrevisaoResumo = useMemo(() => {
    const total = equipamentos.length;
    const comPrevisao = equipamentosPrevisoes.length;

    return {
      total,
      comPrevisao,
      semPrevisao: total - comPrevisao,
      taxaComPrevisao: total > 0 ? Math.round((comPrevisao / total) * 100) : 0
    };
  }, [equipamentos, equipamentosPrevisoes.length]);

  useEffect(() => {
    void carregarDados();
    void carregarJps();
    void carregarRelatorios();
  }, []);

  useEffect(() => {
    if (relatorios.length === 0) {
      setRelatorioSelecionadoId(null);
      return;
    }

    setRelatorioSelecionadoId((atual) =>
      relatorios.some((item) => item.id === atual) ? atual : relatorios[0].id
    );
  }, [relatorios]);

  async function carregarDados() {
    setLoading(true);
    setErro('');

    if (hasSupabaseEnv) {
      const { data, error } = await supabase.from('equipamentos_mina').select('*').order('id', { ascending: true });

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

  async function carregarJps() {
    setLoadingJps(true);
    setErroJps('');

    if (hasSupabaseEnv) {
      const { data, error } = await supabase.from('jps_mina').select('*').order('id', { ascending: true });

      if (error) {
        setErroJps('Falha ao carregar JPs no Supabase. Exibindo dados locais.');
        carregarJpsLocais();
      } else {
        setJps((data ?? []).map(fromSupabaseRow));
      }

      setLoadingJps(false);
      return;
    }

    carregarJpsLocais();
    setLoadingJps(false);
  }

  async function carregarJpsPrevisao() {
    return jps;
  }

  function carregarJpsLocais() {
    const dadosSalvos = localStorage.getItem(JPS_STORAGE_KEY);

    if (!dadosSalvos) {
      setJps([]);
      return;
    }

    try {
      const dados = JSON.parse(dadosSalvos);
      const lista = Array.isArray(dados) ? dados : dados.jps ?? [];
      setJps(lista);
    } catch {
      setJps([]);
    }
  }

  function salvarJpsLocal(lista) {
    localStorage.setItem(JPS_STORAGE_KEY, JSON.stringify(lista));
  }

  async function carregarRelatorios() {
    setRelatorioErro('');

    if (hasSupabaseEnv) {
      const { data, error } = await supabase
        .from('relatorios_diarios_turno')
        .select('*')
        .order('id', { ascending: false });

      if (error) {
        setRelatorioErro('Falha ao carregar relatorios no Supabase. Exibindo dados locais.');
        carregarRelatoriosLocais();
      } else {
        setRelatorios((data ?? []).map(fromSupabaseRelatorioRow));
      }

      return;
    }

    carregarRelatoriosLocais();
  }

  function carregarRelatoriosLocais() {
    const dadosSalvos = localStorage.getItem(RELATORIO_STORAGE_KEY);

    if (!dadosSalvos) {
      setRelatorios([]);
      return;
    }

    try {
      const dados = JSON.parse(dadosSalvos);
      const lista = Array.isArray(dados) ? dados : dados.relatorios ?? [];
      setRelatorios(lista);
    } catch {
      setRelatorios([]);
    }
  }

  function salvarRelatoriosLocal(lista) {
    localStorage.setItem(RELATORIO_STORAGE_KEY, JSON.stringify(lista));
  }

  function onInputChange(event) {
    const { name, value } = event.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };

      if (name === 'horaFim') {
        next.status = resolveEquipamentoStatus(prev.status, value);
      }

      return next;
    });
  }

  function limparFormulario() {
    setFormData(emptyForm);
    setEditandoId(null);
  }

  function onJpInputChange(event) {
    const { name, value } = event.target;
    setJpsFormData((prev) => {
      const next = { ...prev, [name]: value };

      if (name === 'horaFim') {
        next.status = resolveEquipamentoStatus(prev.status, value);
      }

      return next;
    });
  }

  function limparJpFormulario() {
    setJpsFormData(emptyForm);
    setEditandoJpId(null);
  }

  function onRelatorioInputChange(event) {
    const { name, value } = event.target;
    setRelatorioForm((prev) => ({ ...prev, [name]: value }));
  }

  function limparRelatorioFormulario() {
    setRelatorioForm(emptyRelatorioForm);
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
      status: resolveEquipamentoStatus(formData.status, formData.horaFim),
      causa: formData.causa.trim(),
      descricao: formData.descricao.trim(),
      horaInicio: formData.horaInicio,
      horaFim: formData.horaFim,
      previsaoLiberacao: formData.previsaoLiberacao,
      quantidadeDias: calcularQuantidadeDias(now, formData.previsaoLiberacao),
      dataHoraCadastro: now
    };

    if (hasSupabaseEnv) {
      if (editandoId === null) {
        const { error } = await supabase.from('equipamentos_mina').insert(toSupabasePayload(equipamentoPayload));

        if (error) {
          setErro(`Erro ao cadastrar no Supabase: ${error.message}`);
          return;
        }

        setMensagem('Equipamento cadastrado com sucesso.');
        await onRegistrarHistorico({
          email: currentUserEmail,
          acao: 'cadastro_equipamento',
          detalhes: `Equipamento ${equipamentoPayload.nome} cadastrado com status ${equipamentoPayload.status}`
        });
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
        await onRegistrarHistorico({
          email: currentUserEmail,
          acao: 'edicao_equipamento',
          detalhes: `Equipamento ID ${editandoId} atualizado para status ${equipamentoPayload.status}`
        });
      }

      limparFormulario();
      await carregarDados();
      return;
    }

    if (editandoId === null) {
      const nextId =
        equipamentos.length > 0 ? Math.max(...equipamentos.map((item) => Number(item.id) || 0)) + 1 : 1;
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

  async function onSubmitJp(event) {
    event.preventDefault();
    setMensagemJps('');
    setErroJps('');

    if (!jpsFormData.nome.trim() || !jpsFormData.status) {
      return;
    }

    const now = formatDateTime(new Date());
    const jpPayload = {
      nome: jpsFormData.nome.trim(),
      status: resolveEquipamentoStatus(jpsFormData.status, jpsFormData.horaFim),
      causa: jpsFormData.causa.trim(),
      descricao: jpsFormData.descricao.trim(),
      horaInicio: jpsFormData.horaInicio,
      horaFim: jpsFormData.horaFim,
      previsaoLiberacao: jpsFormData.previsaoLiberacao,
      quantidadeDias: calcularQuantidadeDias(now, jpsFormData.previsaoLiberacao),
      dataHoraCadastro: now
    };

    if (hasSupabaseEnv) {
      if (editandoJpId === null) {
        const { error } = await supabase.from('jps_mina').insert(toSupabasePayload(jpPayload));

        if (error) {
          setErroJps(`Erro ao cadastrar JP no Supabase: ${error.message}`);
          return;
        }

        setMensagemJps('JP cadastrado com sucesso.');
        await onRegistrarHistorico({
          email: currentUserEmail,
          acao: 'cadastro_jp',
          detalhes: `JP ${jpPayload.nome} cadastrado com status ${jpPayload.status}`
        });
      } else {
        const { error } = await supabase.from('jps_mina').update(toSupabasePayload(jpPayload)).eq('id', editandoJpId);

        if (error) {
          setErroJps('Erro ao atualizar JP no Supabase.');
          return;
        }

        setMensagemJps('JP atualizado com sucesso.');
        await onRegistrarHistorico({
          email: currentUserEmail,
          acao: 'edicao_jp',
          detalhes: `JP ID ${editandoJpId} atualizado para status ${jpPayload.status}`
        });
      }

      limparJpFormulario();
      await carregarJps();
      return;
    }

    if (editandoJpId === null) {
      const nextId = jps.length > 0 ? Math.max(...jps.map((item) => Number(item.id) || 0)) + 1 : 1;
      const novo = { ...jpPayload, id: nextId };
      const lista = [...jps, novo];
      setJps(lista);
      salvarJpsLocal(lista);
      setMensagemJps('JP cadastrado localmente.');
    } else {
      const lista = jps.map((item) =>
        item.id === editandoJpId ? { ...item, ...jpPayload, id: editandoJpId } : item
      );
      setJps(lista);
      salvarJpsLocal(lista);
      setMensagemJps('JP atualizado localmente.');
    }

    limparJpFormulario();
  }

  function editarJp(item) {
    if (!isAdmin && !statusActions.editar) {
      setErroJps('Seu usuario nao possui permissao para editar na pagina de status de JPs.');
      return;
    }

    setJpsFormData({
      nome: item.nome ?? '',
      status: item.status ?? '',
      causa: item.causa ?? '',
      descricao: item.descricao ?? '',
      horaInicio: item.horaInicio ?? '',
      horaFim: item.horaFim ?? '',
      previsaoLiberacao: item.previsaoLiberacao ?? '',
      quantidadeDias: item.quantidadeDias ?? ''
    });
    setEditandoJpId(item.id);
    setMensagemJps('');
    setErroJps('');
    navigate('/jps-cadastro');
  }

  async function excluirJp(itemId) {
    setMensagemJps('');
    setErroJps('');

    if (!isAdmin && !statusActions.excluir) {
      setErroJps('Seu usuario nao possui permissao para excluir na pagina de status de JPs.');
      return;
    }

    if (hasSupabaseEnv) {
      const { error } = await supabase.from('jps_mina').delete().eq('id', itemId);

      if (error) {
        setErroJps('Erro ao excluir JP no Supabase.');
        return;
      }

      setMensagemJps('JP excluido com sucesso.');
      await onRegistrarHistorico({
        email: currentUserEmail,
        acao: 'exclusao_jp',
        detalhes: `JP ID ${itemId} excluido`
      });
      await carregarJps();
      return;
    }

    const lista = jps.filter((item) => item.id !== itemId);
    setJps(lista);
    salvarJpsLocal(lista);
    setMensagemJps('JP excluido localmente.');
  }

  function editarEquipamento(item) {
    if (!isAdmin && !statusActions.editar) {
      setErro('Seu usuario nao possui permissao para editar na pagina de status.');
      return;
    }

    setFormData({
      nome: item.nome ?? '',
      status: item.status ?? '',
      causa: item.causa ?? '',
      descricao: item.descricao ?? '',
      horaInicio: item.horaInicio ?? '',
      horaFim: item.horaFim ?? '',
      previsaoLiberacao: item.previsaoLiberacao ?? '',
      quantidadeDias: item.quantidadeDias ?? ''
    });
    setEditandoId(item.id);
    setMensagem('');
    setErro('');
    navigate('/');
  }

  async function excluirEquipamento(itemId) {
    setMensagem('');
    setErro('');

    if (!isAdmin && !statusActions.excluir) {
      setErro('Seu usuario nao possui permissao para excluir na pagina de status.');
      return;
    }

    if (hasSupabaseEnv) {
      const { error } = await supabase.from('equipamentos_mina').delete().eq('id', itemId);

      if (error) {
        setErro('Erro ao excluir no Supabase.');
        return;
      }

      setMensagem('Equipamento excluido com sucesso.');
      await onRegistrarHistorico({
        email: currentUserEmail,
        acao: 'exclusao_equipamento',
        detalhes: `Equipamento ID ${itemId} excluido`
      });
      await carregarDados();
      return;
    }

    const lista = equipamentos.filter((item) => item.id !== itemId);
    setEquipamentos(lista);
    salvarLocal(lista);
    setMensagem('Equipamento excluido localmente.');
  }

  async function onSubmitRelatorio(event) {
    event.preventDefault();
    setRelatorioMensagem('');
    setRelatorioErro('');

    if (
      !relatorioForm.dataReferencia ||
      !relatorioForm.turno ||
      !relatorioForm.turma ||
      !relatorioForm.supervisao.trim() ||
      !relatorioForm.liderTecnico.trim()
    ) {
      setRelatorioErro('Preencha os campos obrigatorios do relatorio diario.');
      return;
    }

    const payload = {
      ...relatorioForm,
      supervisao: relatorioForm.supervisao.trim(),
      liderTecnico: relatorioForm.liderTecnico.trim(),
      resumo: relatorioForm.resumo.trim()
    };

    if (hasSupabaseEnv) {
      const { error } = await supabase.from('relatorios_diarios_turno').insert(toSupabaseRelatorioPayload(payload));

      if (error) {
        setRelatorioErro(`Falha ao salvar relatorio no Supabase: ${error.message}`);
        return;
      }

      setRelatorioMensagem('Relatorio diario salvo com sucesso.');
      await onRegistrarHistorico({
        email: currentUserEmail,
        acao: 'cadastro_relatorio_diario',
        detalhes: `Relatorio turno ${payload.turno}, turma ${payload.turma}, data ${payload.dataReferencia}`
      });
      limparRelatorioFormulario();
      await carregarRelatorios();
      return;
    }

    const nextId = relatorios.length > 0 ? Math.max(...relatorios.map((item) => Number(item.id) || 0)) + 1 : 1;
    const novo = {
      id: nextId,
      ...payload,
      criadoEm: new Date().toISOString()
    };
    const lista = [novo, ...relatorios];
    setRelatorios(lista);
    salvarRelatoriosLocal(lista);
    setRelatorioMensagem('Relatorio diario salvo localmente.');
    limparRelatorioFormulario();
  }

  async function excluirRelatorio(item) {
    setRelatorioMensagem('');
    setRelatorioErro('');

    const confirmou = window.confirm(
      `Deseja excluir o relatorio do turno ${item.turno || '-'} / turma ${item.turma || '-'} da data ${item.dataReferencia || '-'}?`
    );

    if (!confirmou) {
      return;
    }

    if (hasSupabaseEnv) {
      const { error } = await supabase.from('relatorios_diarios_turno').delete().eq('id', item.id);

      if (error) {
        setRelatorioErro(`Falha ao excluir relatorio no Supabase: ${error.message}`);
        return;
      }

      setRelatorioMensagem('Relatorio diario excluido com sucesso.');
      await onRegistrarHistorico({
        email: currentUserEmail,
        acao: 'exclusao_relatorio_diario',
        detalhes: `Relatorio ID ${item.id} excluido (turno ${item.turno}, turma ${item.turma}, data ${item.dataReferencia})`
      });
      await carregarRelatorios();
      return;
    }

    const lista = relatorios.filter((relatorio) => relatorio.id !== item.id);
    setRelatorios(lista);
    salvarRelatoriosLocal(lista);
    setRelatorioMensagem('Relatorio diario excluido localmente.');
  }

  return (
    <main className="app-shell">
      <Topo currentUserEmail={currentUserEmail} />
      <Navegacao onLogout={onLogout} isAdmin={isAdmin} pageAccess={pageAccess} />

      <Routes>
        <Route
          path="/dashboard"
          element={
            isAdmin || pageAccess.dashboard ? (
              <DashboardSection
                loading={loading || loadingJps}
                dashboard={dashboard}
                equipamentos={equipamentos}
                jpsDashboard={jpsDashboard}
                jps={jps}
              />
            ) : (
              <Navigate to={landingPath} replace />
            )
          }
        />
        <Route
          path="/"
          element={
            isAdmin || pageAccess.registros || statusActions.editar || statusActions.excluir ? (
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
                  <select id="status" name="status" required value={formData.status} onChange={onInputChange}>
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

                  <label htmlFor="previsaoLiberacao">Previsao de Liberacao</label>
                  <input
                    id="previsaoLiberacao"
                    name="previsaoLiberacao"
                    type="date"
                    value={formData.previsaoLiberacao}
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
            ) : (
              <Navigate to={landingPath} replace />
            )
          }
        />
        <Route
          path="/jps-cadastro"
          element={
            isAdmin || pageAccess.jpsCadastro || statusActions.editar || statusActions.excluir ? (
              <section className="panel">
                <h2>Cadastro de JPs</h2>

                <form className="form-grid" onSubmit={onSubmitJp}>
                  <label htmlFor="jpNome">Tag do JP</label>
                  <input
                    id="jpNome"
                    name="nome"
                    type="text"
                    placeholder="Digite o Tag do JP"
                    required
                    value={jpsFormData.nome}
                    onChange={onJpInputChange}
                  />

                  <label htmlFor="jpStatus">Status</label>
                  <select id="jpStatus" name="status" required value={jpsFormData.status} onChange={onJpInputChange}>
                    <option value="" disabled>
                      Selecione o status
                    </option>
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="jpCausa">Equipamento / Causa</label>
                  <input
                    id="jpCausa"
                    name="causa"
                    type="text"
                    placeholder="Equipamento e a causa (se aplicavel)"
                    value={jpsFormData.causa}
                    onChange={onJpInputChange}
                  />

                  <label htmlFor="jpDescricao">Descricao</label>
                  <input
                    id="jpDescricao"
                    name="descricao"
                    type="text"
                    placeholder="Descricao adicional do JP"
                    value={jpsFormData.descricao}
                    onChange={onJpInputChange}
                  />

                  <label htmlFor="jpHoraInicio">Horario Inicio</label>
                  <input
                    id="jpHoraInicio"
                    name="horaInicio"
                    type="time"
                    value={jpsFormData.horaInicio}
                    onChange={onJpInputChange}
                  />

                  <label htmlFor="jpHoraFim">Horario Fim</label>
                  <input
                    id="jpHoraFim"
                    name="horaFim"
                    type="time"
                    value={jpsFormData.horaFim}
                    onChange={onJpInputChange}
                  />

                  <label htmlFor="jpPrevisaoLiberacao">Previsao de Liberacao</label>
                  <input
                    id="jpPrevisaoLiberacao"
                    name="previsaoLiberacao"
                    type="date"
                    value={jpsFormData.previsaoLiberacao}
                    onChange={onJpInputChange}
                  />

                  <div className="actions">
                    <button type="submit">{editandoJpId === null ? 'Cadastrar' : 'Atualizar'}</button>
                    <button type="button" className="ghost" onClick={limparJpFormulario}>
                      Limpar
                    </button>
                  </div>
                </form>

                {mensagemJps && <p className="feedback success">{mensagemJps}</p>}
                {erroJps && <p className="feedback error">{erroJps}</p>}
              </section>
            ) : (
              <Navigate to={landingPath} replace />
            )
          }
        />
        <Route
          path="/status"
          element={
            isAdmin || pageAccess.status ? (
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
                                {(isAdmin || statusActions.editar) && (
                                  <button className="small" onClick={() => editarEquipamento(item)}>
                                    Editar
                                  </button>
                                )}
                                {(isAdmin || statusActions.excluir) && (
                                  <button className="small danger" onClick={() => excluirEquipamento(item.id)}>
                                    Excluir
                                  </button>
                                )}
                                {!isAdmin && !statusActions.editar && !statusActions.excluir && '-'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ) : (
              <Navigate to={landingPath} replace />
            )
          }
        />
        <Route
          path="/jps-status"
          element={
            isAdmin || pageAccess.jpsStatus ? (
              <section className="panel">
                <h2>Status de JPs</h2>
                {loadingJps ? (
                  <p>Carregando...</p>
                ) : (
                  <div className="table-wrap">
                    <table className="jps-status-table">
                      <thead>
                        <tr>
                          <th>JP</th>
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
                        {jps.length === 0 ? (
                          <tr>
                            <td colSpan="8">Nenhum registro encontrado.</td>
                          </tr>
                        ) : (
                          jps.map((item) => (
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
                                {(isAdmin || statusActions.editar) && (
                                  <button className="small" onClick={() => editarJp(item)}>
                                    Editar
                                  </button>
                                )}
                                {(isAdmin || statusActions.excluir) && (
                                  <button className="small danger" onClick={() => excluirJp(item.id)}>
                                    Excluir
                                  </button>
                                )}
                                {!isAdmin && !statusActions.editar && !statusActions.excluir && '-'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ) : (
              <Navigate to={landingPath} replace />
            )
          }
        />
        <Route
          path="/jps-status-previsto"
          element={
            isAdmin || pageAccess.jpsStatusPrevisto ? (
              <section className="panel">
                <h2>Status de JPs - Previsao de Liberacao</h2>
                <p>
                  Consulte a previsao de liberacao e a quantidade de dias calculada automaticamente a partir da data de
                  cadastro e da previsao informada para os JPs.
                </p>
                <div className="dash-grid">
                  <article className="dash-card total">
                    <h3>Total de JPs</h3>
                    <p>{jpsPrevisaoResumo.total}</p>
                  </article>
                  <article className="dash-card released">
                    <h3>JPs com previsao</h3>
                    <p>{jpsPrevisaoResumo.comPrevisao}</p>
                    <small>{jpsPrevisaoResumo.taxaComPrevisao}% do total</small>
                  </article>
                  <article className="dash-card stopped">
                    <h3>JPs sem previsao</h3>
                    <p>{jpsPrevisaoResumo.semPrevisao}</p>
                  </article>
                  <article className="dash-card total">
                    <h3>JPs liberados</h3>
                    <p>{jps.filter((item) => item.status === 'liberado').length}</p>
                  </article>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>JP</th>
                        <th>Status</th>
                        <th>Previsao de Liberacao</th>
                        <th>Quantidade de Dias</th>
                        <th>Causa da Parada</th>
                        <th>Descricao</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jps.length === 0 ? (
                        <tr>
                          <td colSpan="6">Nenhum registro encontrado.</td>
                        </tr>
                      ) : (
                        jps.map((item) => (
                          <tr key={item.id}>
                            <td>{item.nome}</td>
                            <td>
                              <span className={`status-chip status-${item.status}`}>
                                {statusOptions.find((option) => option.value === item.status)?.label ?? item.status}
                              </span>
                            </td>
                            <td>{item.previsaoLiberacao ? formatDateOnly(item.previsaoLiberacao) : '-'}</td>
                            <td>{item.quantidadeDias ? item.quantidadeDias : '-'}</td>
                            <td>{item.causa || '-'}</td>
                            <td>{item.descricao || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="dash-list">
                  <h3>JPs com previsao cadastrada</h3>
                  {jpsPrevisoes.length === 0 ? (
                    <p>Nenhuma previsao cadastrada.</p>
                  ) : (
                    <ul>
                      {jpsPrevisoes.map((item) => (
                        <li key={item.id}>
                          <strong>{item.nome}</strong> - Previsao:{' '}
                          {item.previsaoLiberacao ? formatDateOnly(item.previsaoLiberacao) : '-'} / Dias:{' '}
                          {item.quantidadeDias || '-'}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="dash-list">
                  <h3>Prazos nao concluídos dos JPs</h3>
                  {jpsPrazosNaoConcluidos.length === 0 ? (
                    <p>Nenhum prazo pendente.</p>
                  ) : (
                    <ul>
                      {jpsPrazosNaoConcluidos.map((item) => (
                        <li key={item.id}>
                          <strong>{item.nome}</strong> - Sem previsao de liberacao cadastrada.
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            ) : (
              <Navigate to={landingPath} replace />
            )
          }
        />
        <Route
          path="/status-previsto"
          element={
            isAdmin || pageAccess.statusPrevisto ? (
              <section className="panel">
                <h2>Status Equipamentos Moveis - Previsao de Liberacao</h2>
                <p>
                  Consulte a previsao de liberacao e a quantidade de dias calculada automaticamente a partir da data de
                  cadastro e da previsao informada.
                </p>

                <div className="dash-grid">
                  <article className="dash-card total">
                    <h3>Total de Equipamentos</h3>
                    <p>{equipamentosPrevisaoResumo.total}</p>
                  </article>
                  <article className="dash-card released">
                    <h3>Com previsao</h3>
                    <p>{equipamentosPrevisaoResumo.comPrevisao}</p>
                    <small>{equipamentosPrevisaoResumo.taxaComPrevisao}% do total</small>
                  </article>
                  <article className="dash-card stopped">
                    <h3>Sem previsao</h3>
                    <p>{equipamentosPrevisaoResumo.semPrevisao}</p>
                  </article>
                  <article className="dash-card total">
                    <h3>Liberados</h3>
                    <p>{equipamentos.filter((item) => item.status === 'liberado').length}</p>
                  </article>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Equipamento</th>
                        <th>Status</th>
                        <th>Previsao de Liberacao</th>
                        <th>Quantidade de Dias</th>
                        <th>Causa da Parada</th>
                        <th>Descricao</th>
                      </tr>
                    </thead>
                    <tbody>
                      {equipamentos.length === 0 ? (
                        <tr>
                          <td colSpan="6">Nenhum registro encontrado.</td>
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
                            <td>{item.previsaoLiberacao ? formatDateOnly(item.previsaoLiberacao) : '-'}</td>
                            <td>{item.quantidadeDias ? item.quantidadeDias : '-'}</td>
                            <td>{item.causa || '-'}</td>
                            <td>{item.descricao || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="dash-list">
                  <h3>Equipamentos com previsao cadastrada</h3>
                  {equipamentosPrevisoes.length === 0 ? (
                    <p>Nenhuma previsao cadastrada.</p>
                  ) : (
                    <ul>
                      {equipamentosPrevisoes.map((item) => (
                        <li key={item.id}>
                          <strong>{item.nome}</strong> - Previsao:{' '}
                          {item.previsaoLiberacao ? formatDateOnly(item.previsaoLiberacao) : '-'} / Dias:{' '}
                          {item.quantidadeDias || '-'}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="dash-list">
                  <h3>Prazos nao concluídos dos equipamentos</h3>
                  {equipamentosPrazosNaoConcluidos.length === 0 ? (
                    <p>Nenhum prazo pendente.</p>
                  ) : (
                    <ul>
                      {equipamentosPrazosNaoConcluidos.map((item) => (
                        <li key={item.id}>
                          <strong>{item.nome}</strong> - Sem previsao de liberacao cadastrada.
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            ) : (
              <Navigate to={landingPath} replace />
            )
          }
        />
        <Route
          path="/relatorios"
          element={
            isAdmin || pageAccess.relatorios ? (
              <section className="panel relatorio-panel">
              <div className="relatorio-header">
                <div>
                  <h2>Relatorio Diario por Turno</h2>
                  <p>Registro operacional por turno e turma com responsaveis e janela de horario.</p>
                </div>
                <div className="relatorio-kpis">
                  <article className="relatorio-kpi">
                    <span>Total de relatorios</span>
                    <strong>{relatorioResumo.total}</strong>
                  </article>
                  <article className="relatorio-kpi">
                    <span>Ultimo turno</span>
                    <strong>{relatorioResumo.ultimoTurno}</strong>
                  </article>
                  <article className="relatorio-kpi">
                    <span>Ultima atualizacao</span>
                    <strong>{relatorioResumo.ultimaAtualizacao}</strong>
                  </article>
                </div>
              </div>

              <div className="relatorio-form-card">
                <h3>Novo Relatorio</h3>
                <form className="form-grid relatorio-form" onSubmit={onSubmitRelatorio}>
                  <div className="relatorio-row">
                    <div>
                      <label htmlFor="dataReferencia">Data</label>
                      <input
                        id="dataReferencia"
                        name="dataReferencia"
                        type="date"
                        required
                        value={relatorioForm.dataReferencia}
                        onChange={onRelatorioInputChange}
                      />
                    </div>
                    <div>
                      <label htmlFor="turno">Turno</label>
                      <select id="turno" name="turno" required value={relatorioForm.turno} onChange={onRelatorioInputChange}>
                        {turnoOptions.map((turno) => (
                          <option key={turno} value={turno}>
                            {turno}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="turma">Turma</label>
                      <select id="turma" name="turma" required value={relatorioForm.turma} onChange={onRelatorioInputChange}>
                        {turmaOptions.map((turma) => (
                          <option key={turma} value={turma}>
                            {turma}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="relatorio-row">
                    <div>
                      <label htmlFor="horaInicioRelatorio">Hora Inicio</label>
                      <input
                        id="horaInicioRelatorio"
                        name="horaInicio"
                        type="time"
                        value={relatorioForm.horaInicio}
                        onChange={onRelatorioInputChange}
                      />
                    </div>
                    <div>
                      <label htmlFor="horaFimRelatorio">Hora Fim</label>
                      <input
                        id="horaFimRelatorio"
                        name="horaFim"
                        type="time"
                        value={relatorioForm.horaFim}
                        onChange={onRelatorioInputChange}
                      />
                    </div>
                  </div>

                  <div className="relatorio-row">
                    <div>
                      <label htmlFor="supervisao">Supervisao</label>
                      <input
                        id="supervisao"
                        name="supervisao"
                        type="text"
                        required
                        placeholder="Nome da supervisao"
                        value={relatorioForm.supervisao}
                        onChange={onRelatorioInputChange}
                      />
                    </div>
                    <div>
                      <label htmlFor="liderTecnico">Lider Tecnico</label>
                      <input
                        id="liderTecnico"
                        name="liderTecnico"
                        type="text"
                        required
                        placeholder="Nome do lider tecnico"
                        value={relatorioForm.liderTecnico}
                        onChange={onRelatorioInputChange}
                      />
                    </div>
                  </div>

                  <label htmlFor="resumo">Resumo do Turno</label>
                  <textarea
                    id="resumo"
                    name="resumo"
                    rows="3"
                    placeholder="Breve resumo diario"
                    value={relatorioForm.resumo}
                    onChange={onRelatorioInputChange}
                  />

                  <div className="actions">
                    <button type="submit">Salvar Relatorio</button>
                    <button type="button" className="ghost" onClick={limparRelatorioFormulario}>
                      Limpar
                    </button>
                  </div>
                </form>
              </div>

              {relatorioMensagem && <p className="feedback success">{relatorioMensagem}</p>}
              {relatorioErro && <p className="feedback error">{relatorioErro}</p>}

              <div className="turno-filter-bar" role="group" aria-label="Filtro por turno">
                <button
                  type="button"
                  className={`turno-filter-btn ${filtroTurno === 'TODOS' ? 'active' : ''}`}
                  onClick={() => setFiltroTurno('TODOS')}
                >
                  Todos
                </button>
                {turnoOptions.map((turno) => (
                  <button
                    key={turno}
                    type="button"
                    className={`turno-filter-btn ${filtroTurno === turno ? 'active' : ''}`}
                    onClick={() => setFiltroTurno(turno)}
                  >
                    Turno {turno}
                  </button>
                ))}
              </div>

              <div className="table-wrap relatorio-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Turno</th>
                      <th>Turma</th>
                      <th>Hora Inicio</th>
                      <th>Hora Fim</th>
                      <th>Supervisao</th>
                      <th>Lider Tecnico</th>
                      <th>Resumo</th>
                      <th>Criado em</th>
                      <th>Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatoriosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan="10">Nenhum relatorio diario cadastrado.</td>
                      </tr>
                    ) : (
                      relatoriosFiltrados.map((item) => (
                        <tr
                          key={item.id}
                          className={`relatorio-row-item ${item.id === relatorioSelecionadoId ? 'is-selected' : ''}`}
                          onClick={() => setRelatorioSelecionadoId(item.id)}
                        >
                          <td>{item.dataReferencia || '-'}</td>
                          <td>
                            <span className="turno-chip">Turno {item.turno || '-'}</span>
                          </td>
                          <td>
                            <span className="turma-chip">Turma {item.turma || '-'}</span>
                          </td>
                          <td>{item.horaInicio || '-'}</td>
                          <td>{item.horaFim || '-'}</td>
                          <td>{item.supervisao || '-'}</td>
                          <td>{item.liderTecnico || '-'}</td>
                          <td>{item.resumo || '-'}</td>
                          <td>{item.criadoEm ? formatDateTime(new Date(item.criadoEm)) : '-'}</td>
                          <td className="actions-cell">
                            <button
                              type="button"
                              className="small"
                              onClick={(event) => {
                                event.stopPropagation();
                                setRelatorioSelecionadoId(item.id);
                              }}
                            >
                              Ler
                            </button>
                            <button
                              type="button"
                              className="small danger"
                              onClick={(event) => {
                                event.stopPropagation();
                                void excluirRelatorio(item);
                              }}
                            >
                              Excluir
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {relatorioSelecionado && (
                <section className="relatorio-read-card" aria-live="polite">
                  <h3>Leitura do Relatorio Selecionado</h3>
                  <p>
                    Data {formatDateOnly(relatorioSelecionado.dataReferencia)} | Turno {relatorioSelecionado.turno || '-'} |
                    Turma {relatorioSelecionado.turma || '-'}
                  </p>
                  <div className="relatorio-read-grid">
                    <article>
                      <h4>Janela de Horario</h4>
                      <p>
                        Inicio: {relatorioSelecionado.horaInicio || '-'} | Fim: {relatorioSelecionado.horaFim || '-'}
                      </p>
                    </article>
                    <article>
                      <h4>Responsaveis</h4>
                      <p>Supervisao: {relatorioSelecionado.supervisao || '-'}</p>
                      <p>Lider Tecnico: {relatorioSelecionado.liderTecnico || '-'}</p>
                    </article>
                  </div>
                  <article className="relatorio-read-summary">
                    <h4>Resumo do Turno</h4>
                    <p>{relatorioSelecionado.resumo || 'Sem resumo informado.'}</p>
                  </article>
                  <small>
                    Cadastrado em:{' '}
                    {relatorioSelecionado.criadoEm ? formatDateTime(new Date(relatorioSelecionado.criadoEm)) : '-'}
                  </small>
                </section>
              )}
            </section>
            ) : (
              <Navigate to={landingPath} replace />
            )
          }
        />
        <Route
          path="/admin"
          element={
            isAdmin ? (
              <AdminPage currentUserEmail={currentUserEmail} onRegistrarHistorico={onRegistrarHistorico} />
            ) : (
              <Navigate to={landingPath} replace />
            )
          }
        />
        <Route
          path="/admin/historico"
          element={isAdmin ? <AdminHistoricoPage /> : <Navigate to={landingPath} replace />}
        />
        <Route
          path="/sem-acesso"
          element={
            <section className="panel">
              <h2>Acesso sem paginas liberadas</h2>
              <p>Seu usuario foi aprovado, mas nenhuma pagina foi liberada para o seu perfil.</p>
              <p>Solicite ao administrador a liberacao das paginas necessarias.</p>
            </section>
          }
        />
        <Route path="*" element={<Navigate to={landingPath} replace />} />
      </Routes>
    </main>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [pageAccess, setPageAccess] = useState(DEFAULT_PAGE_ACCESS);
  const [statusActions, setStatusActions] = useState(DEFAULT_STATUS_ACTIONS);

  const isAdmin = isAdminEmail(currentUserEmail);

  async function registrarHistorico({ email, acao, detalhes }) {
    if (!hasSupabaseEnv || !supabase) {
      return;
    }

    const emailUsuario = normalizeEmail(email);

    if (!emailUsuario || !acao) {
      return;
    }

    await supabase.from('historico_sistema').insert({
      email_usuario: emailUsuario,
      acao,
      detalhes: detalhes ?? ''
    });
  }

  async function validarAcessoLiberado(emailUsuario) {
    const email = normalizeEmail(emailUsuario);

    if (!email) {
      return {
        ok: false,
        message: 'Usuario sem email valido.',
        pageAccess: DEFAULT_PAGE_ACCESS,
        statusActions: DEFAULT_STATUS_ACTIONS
      };
    }

    if (isAdminEmail(email)) {
      return { ok: true, message: '', pageAccess: getAdminAccess(), statusActions: getAdminStatusActions() };
    }

    const { data, error } = await supabase
      .from('acessos_sistema')
      .select(
        'status, acesso_dashboard, acesso_registros, acesso_jps_cadastro, acesso_jps_status, acesso_jps_status_previsto, acesso_status, acesso_status_previsto, acesso_relatorios, pode_editar_status, pode_excluir_status'
      )
      .eq('email', email)
      .maybeSingle();

    if (error) {
      return {
        ok: false,
        message: `Falha ao validar acesso: ${error.message}`,
        pageAccess: DEFAULT_PAGE_ACCESS,
        statusActions: DEFAULT_STATUS_ACTIONS
      };
    }

    if (!data || data.status === 'pendente') {
      return {
        ok: false,
        message:
          'Confirme o email recebido e aguarde o administrador (jacksonandradesilva33@gmail.com) liberar seu acesso.',
        pageAccess: DEFAULT_PAGE_ACCESS,
        statusActions: DEFAULT_STATUS_ACTIONS
      };
    }

    if (data.status === 'bloqueado') {
      return {
        ok: false,
        message: 'Seu acesso foi bloqueado pelo administrador.',
        pageAccess: DEFAULT_PAGE_ACCESS,
        statusActions: DEFAULT_STATUS_ACTIONS
      };
    }

    const acessos = fromAcessoRowToPageAccess(data);
    const acoesStatus = fromAcessoRowToStatusActions(data);

    if (
      !acessos.dashboard &&
      !acessos.registros &&
      !acessos.jpsCadastro &&
      !acessos.jpsStatus &&
      !acessos.jpsStatusPrevisto &&
      !acessos.status &&
      !acessos.statusPrevisto &&
      !acessos.relatorios
    ) {
      return {
        ok: false,
        message: 'Acesso aprovado, mas sem paginas liberadas. Fale com o administrador.',
        pageAccess: DEFAULT_PAGE_ACCESS,
        statusActions: DEFAULT_STATUS_ACTIONS
      };
    }

    return { ok: true, message: '', pageAccess: acessos, statusActions: acoesStatus };
  }

  useEffect(() => {
    if (!hasSupabaseEnv || !supabase) {
      setAuthLoading(false);
      return;
    }

    let ativo = true;

    const carregarSessao = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!ativo) {
        return;
      }

      if (error) {
        setIsAuthenticated(false);
        setCurrentUserEmail('');
        setPageAccess(DEFAULT_PAGE_ACCESS);
        setStatusActions(DEFAULT_STATUS_ACTIONS);
        setAuthLoading(false);
        return;
      }

      const emailSessao = data.session?.user?.email?.toLowerCase() ?? '';

      if (!data.session) {
        setCurrentUserEmail('');
        setPageAccess(DEFAULT_PAGE_ACCESS);
        setStatusActions(DEFAULT_STATUS_ACTIONS);
        setIsAuthenticated(false);
        setAuthLoading(false);
        return;
      }

      const validacao = await validarAcessoLiberado(emailSessao);

      if (!validacao.ok) {
        await supabase.auth.signOut();
        setAuthNotice(validacao.message);
        setCurrentUserEmail('');
        setPageAccess(DEFAULT_PAGE_ACCESS);
        setStatusActions(DEFAULT_STATUS_ACTIONS);
        setIsAuthenticated(false);
        setAuthLoading(false);
        return;
      }

      setAuthNotice('');
      setCurrentUserEmail(emailSessao);
      setPageAccess(validacao.pageAccess);
      setStatusActions(validacao.statusActions);
      setIsAuthenticated(true);
      setAuthLoading(false);
    };

    void carregarSessao();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        setCurrentUserEmail('');
        setPageAccess(DEFAULT_PAGE_ACCESS);
        setStatusActions(DEFAULT_STATUS_ACTIONS);
        setIsAuthenticated(false);
        setAuthLoading(false);
        return;
      }

      const emailSessao = session.user?.email?.toLowerCase() ?? '';
      const validacao = await validarAcessoLiberado(emailSessao);

      if (!validacao.ok) {
        await supabase.auth.signOut();
        setAuthNotice(validacao.message);
        setCurrentUserEmail('');
        setPageAccess(DEFAULT_PAGE_ACCESS);
        setStatusActions(DEFAULT_STATUS_ACTIONS);
        setIsAuthenticated(false);
        setAuthLoading(false);
        return;
      }

      setAuthNotice('');
      setCurrentUserEmail(emailSessao);
      setPageAccess(validacao.pageAccess);
      setStatusActions(validacao.statusActions);
      setIsAuthenticated(true);
      setAuthLoading(false);
    });

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, []);

  async function fazerLogin(usuario, senha) {
    if (!hasSupabaseEnv || !supabase) {
      return 'Supabase nao configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.';
    }

    const email = normalizeEmail(usuario);

    if (!email || !senha) {
      return 'Informe email e senha.';
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha
    });

    if (error) {
      const mensagem = (error.message || '').toLowerCase();

      if (mensagem.includes('email not confirmed')) {
        return 'Voce precisa confirmar o email recebido e aguardar a liberacao do administrador (jacksonandradesilva33@gmail.com).';
      }

      if (mensagem.includes('invalid login credentials')) {
        return 'Email ou senha invalidos.';
      }

      if (mensagem.includes('email logins are disabled')) {
        return 'Login por email/senha esta desativado no Supabase Auth.';
      }

      return `Falha no login: ${error.message}`;
    }

    const emailSessao = data.user?.email?.toLowerCase() ?? email;
    const validacao = await validarAcessoLiberado(emailSessao);

    if (!validacao.ok) {
      await supabase.auth.signOut();
      return validacao.message;
    }

    setAuthNotice('');
    setPageAccess(validacao.pageAccess);
    setStatusActions(validacao.statusActions);
    await registrarHistorico({
      email: emailSessao,
      acao: 'login_sistema',
      detalhes: 'Login realizado com sucesso'
    });
    return '';
  }

  async function sairDoSistema() {
    if (hasSupabaseEnv && supabase) {
      await supabase.auth.signOut();
    }

    setCurrentUserEmail('');
    setPageAccess(DEFAULT_PAGE_ACCESS);
    setStatusActions(DEFAULT_STATUS_ACTIONS);
    setIsAuthenticated(false);
  }

  async function fazerCadastro(emailCadastro, senhaCadastro) {
    if (!hasSupabaseEnv || !supabase) {
      return {
        ok: false,
        message: 'Supabase nao configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.'
      };
    }

    const email = normalizeEmail(emailCadastro);

    if (!email || !senhaCadastro) {
      return { ok: false, message: 'Informe email e senha.' };
    }

    const { error } = await supabase.auth.signUp({
      email,
      password: senhaCadastro,
      options: {
        emailRedirectTo: `${window.location.origin}/login`
      }
    });

    if (error) {
      const mensagem = (error.message || '').toLowerCase();

      if (mensagem.includes('already registered') || mensagem.includes('already been registered')) {
        return { ok: false, message: 'Este email ja esta cadastrado.' };
      }

      if (mensagem.includes('password')) {
        return { ok: false, message: `Senha invalida: ${error.message}` };
      }

      return { ok: false, message: `Falha ao cadastrar: ${error.message}` };
    }

    const { error: acessoError } = await supabase.from('acessos_sistema').insert({
      email,
      status: isAdminEmail(email) ? 'aprovado' : 'pendente',
      acesso_dashboard: true,
      acesso_registros: false,
      acesso_jps_cadastro: false,
      acesso_jps_status: false,
      acesso_jps_status_previsto: false,
      acesso_status: false,
      acesso_status_previsto: false,
      acesso_relatorios: false,
      pode_editar_status: false,
      pode_excluir_status: false,
      liberado_em: isAdminEmail(email) ? new Date().toISOString() : null,
      liberado_por: isAdminEmail(email) ? email : null
    });

    if (acessoError) {
      const mensagemAcesso = (acessoError.message || '').toLowerCase();

      if (mensagemAcesso.includes('duplicate key value') || mensagemAcesso.includes('already exists')) {
        return {
          ok: true,
          message:
            'Cadastro realizado. Se este email ja existia no controle de acessos, mantenha a confirmacao no email e aguarde a liberacao do administrador (jacksonandradesilva33@gmail.com).'
        };
      }

      return {
        ok: false,
        message: `Usuario criado no Auth, mas falhou ao registrar solicitacao de acesso: ${acessoError.message}`
      };
    }

    return {
      ok: true,
      message:
        'Cadastro realizado com sucesso. Verifique seu email, confirme a conta e depois aguarde o administrador (jacksonandradesilva33@gmail.com) liberar seu acesso na pagina de liberacoes.'
    };
  }

  if (authLoading) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <h1>Status Equipamentos Moveis</h1>
          <p>Validando sessao...</p>
        </section>
      </main>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? <Navigate to={getLandingPath(pageAccess, statusActions, isAdmin)} replace /> : <LoginPage onLogin={fazerLogin} notice={authNotice} />
          }
        />
        <Route
          path="/cadastro"
          element={
            isAuthenticated ? <Navigate to={getLandingPath(pageAccess, statusActions, isAdmin)} replace /> : <CadastroPage onRegister={fazerCadastro} />
          }
        />
        <Route
          path="/*"
          element={
            isAuthenticated ? (
              <AppContent
                onLogout={sairDoSistema}
                isAdmin={isAdmin}
                currentUserEmail={currentUserEmail}
                pageAccess={pageAccess}
                statusActions={statusActions}
                onRegistrarHistorico={registrarHistorico}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
