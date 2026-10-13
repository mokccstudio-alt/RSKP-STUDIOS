import React, { useState } from 'react';
import {
  Shield,
  Gamepad2,
  Terminal,
  Server,
  Database,
  CheckCircle2,
  Clock,
  Key,
  Users,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  Code2,
  Play,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Radio
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'discord' | 'roblox' | 'api' | 'simulator'>('overview');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Simulator state
  const [simStep, setSimStep] = useState<'unlinked' | 'code_generated' | 'linked' | 'pending' | 'in_game' | 'ended'>('unlinked');
  const [simCode, setSimCode] = useState('B8K-3M9');
  const [simElapsed, setSimElapsed] = useState(0);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSimStart = () => {
    if (simStep === 'unlinked') {
      alert('⚠️ Primero debes vincular tu cuenta con /vincular.');
      return;
    }
    setSimStep('pending');
  };

  const handleSimEnterGame = () => {
    setSimStep('in_game');
    setSimElapsed(1);
  };

  const handleSimStop = () => {
    setSimStep('ended');
  };

  const handleSimReset = () => {
    setSimStep('unlinked');
    setSimElapsed(0);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Top Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">Roblox Staff Service</span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Railway & Discord v14 Ready
                </span>
              </div>
              <p className="text-xs text-slate-400">Sistema Integral de Fichaje y Turnos para Staff</p>
            </div>
          </div>

          <nav className="flex items-center gap-1 sm:gap-2">
            {[
              { id: 'overview', label: 'General', icon: Server },
              { id: 'discord', label: 'Bot & Panel', icon: Terminal },
              { id: 'roblox', label: 'Roblox Luau', icon: Gamepad2 },
              { id: 'api', label: 'API & Base de Datos', icon: Database },
              { id: 'simulator', label: 'Simulador', icon: Play },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden md:inline">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Hero Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950/70 via-slate-900 to-slate-900 border border-indigo-900/40 p-6 sm:p-8">
              <div className="relative z-10 max-w-3xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold mb-4">
                  <Sparkles className="h-3.5 w-3.5" /> Arquitectura Monolítica Optimizada para Railway
                </div>
                <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                  Control Automatizado de Turnos del Staff en Roblox sincronizado con Discord
                </h1>
                <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed">
                  Sistema sin trampas (anti-afk y anti-spoofing). El staff inicia turno desde el panel interactivo de Discord, el servidor de Roblox envía latidos de presencia cada 25 segundos y PostgreSQL calcula las horas efectivas con reconciliador automático de desconexión.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={() => setActiveTab('simulator')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                  >
                    <Play className="h-4 w-4" /> Probar Simulador de Turno
                  </button>
                  <button
                    onClick={() => setActiveTab('roblox')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-slate-700 transition-all cursor-pointer"
                  >
                    <Code2 className="h-4 w-4" /> Ver Scripts de Roblox Studio
                  </button>
                </div>
              </div>

              {/* Decorative Glow */}
              <div className="absolute right-0 top-0 -mr-16 -mt-16 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute right-20 bottom-0 w-64 h-64 bg-violet-500/10 rounded-full blur-2xl pointer-events-none" />
            </div>

            {/* Architecture Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1 */}
              <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all">
                <div className="h-10 w-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4">
                  <Terminal className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-white text-base">Bot de Discord v14</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Panel persistente con botones directos (<code>BUTTON.START</code>, <code>BUTTON.STOP</code>, <code>BUTTON.STATUS</code>) y 7 comandos slash con comprobación de roles del staff y administradores.
                </p>
                <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-indigo-400 flex items-center justify-between">
                  <span>Slash & Buttons</span>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>

              {/* Card 2 */}
              <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
                  <Radio className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-white text-base">API Fastify en Railway</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Endpoints seguros <code>/api/roblox/presence</code> y <code>/api/roblox/link/verify</code> con autenticación Bearer mediante HMAC/SHA-256 de tiempo constante, rate-limiting y healthcheck <code>/health</code>.
                </p>
                <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-emerald-400 flex items-center justify-between">
                  <span>0.0.0.0:${'{PORT}'}</span>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>

              {/* Card 3 */}
              <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all">
                <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4">
                  <Gamepad2 className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-white text-base">Roblox Luau Client & Server</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  <code>StaffService.server.lua</code> recopila jugadores cada 25s e intercambia tokens. <code>LinkClient.client.lua</code> incluye una elegante UI modal para canjear códigos de 6 caracteres.
                </p>
                <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-amber-400 flex items-center justify-between">
                  <span>RemoteEvents & UI</span>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            </div>

            {/* Shift Lifecycle Pipeline */}
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-indigo-400" /> Ciclo de Vida del Turno de Servicio
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/60 relative">
                  <span className="text-xs font-mono font-bold text-indigo-400">PASO 1</span>
                  <h4 className="font-semibold text-white mt-1 text-sm">/vincular</h4>
                  <p className="text-xs text-slate-400 mt-1">Vincula directamente por ID numérico o username consultando la API de Roblox.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/60 relative">
                  <span className="text-xs font-mono font-bold text-emerald-400">PASO 2</span>
                  <h4 className="font-semibold text-white mt-1 text-sm">Entrar en Servicio</h4>
                  <p className="text-xs text-slate-400 mt-1">El usuario presiona el botón en Discord. Si no está en el juego, pasa a estado <code>pending</code>.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/60 relative">
                  <span className="text-xs font-mono font-bold text-amber-400">PASO 3</span>
                  <h4 className="font-semibold text-white mt-1 text-sm">Latido de Presencia</h4>
                  <p className="text-xs text-slate-400 mt-1">Roblox envía heartbeat cada 25s. La sesión pasa a <code>active</code> y el reloj suma segundos.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/60 relative">
                  <span className="text-xs font-mono font-bold text-rose-400">PASO 4</span>
                  <h4 className="font-semibold text-white mt-1 text-sm">Salida o Timeout</h4>
                  <p className="text-xs text-slate-400 mt-1">El usuario pulsa Salir o el Reconciliador detecta desconexión tras 120s de gracia y guarda la sesión.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DISCORD BOT */}
        {activeTab === 'discord' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Panel Preview */}
            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
              <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Terminal className="h-5 w-5 text-indigo-400" /> Vista Previa del Panel de Control en Discord
              </h2>
              <p className="text-xs text-slate-400 mb-6">
                Este es el mensaje embebido exacto y los botones generados por <code>src/bot/panel.ts</code> al ejecutar <code>/set-enterinserv</code>:
              </p>

              {/* Discord Mock UI */}
              <div className="max-w-2xl bg-[#313338] rounded-xl p-5 border border-slate-700 shadow-2xl font-sans">
                {/* Embed */}
                <div className="border-l-4 border-[#2b2d31] bg-[#2b2d31]/80 rounded-r-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 text-white font-bold text-base">
                    🛡️ Panel de Control de Servicio Staff
                  </div>
                  <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
                    <p>Bienvenido al sistema de fichaje y registro de actividad para el equipo del staff.</p>
                    <p className="font-semibold text-slate-200">Instrucciones de uso:</p>
                    <ul className="list-disc list-inside space-y-1 text-slate-300">
                      <li><strong className="text-emerald-400">🟢 Entrar en servicio:</strong> Inicia tu turno. Si ya estás en el juego, comenzará al instante. Si no, tendrás margen para conectarte.</li>
                      <li><strong className="text-rose-400">🔴 Salir:</strong> Concluye tu turno actual y guarda el tiempo total trabajado en la base de datos.</li>
                      <li><strong className="text-slate-300">📊 Mi Estado:</strong> Muestra en un mensaje privado tu estado actual, tiempo transcurrido y cuenta vinculada.</li>
                    </ul>
                    <p className="text-amber-300/90 pt-1 text-[11px]">
                      ⚠️ <em>Nota: Es indispensable vincular tu cuenta previamente con /vincular.</em>
                    </p>
                  </div>
                  <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-700/50 flex items-center justify-between">
                    <span>Sistema de Servicio Staff • Sincronizado en tiempo real con Roblox</span>
                    <span>Hoy a las 12:00</span>
                  </div>
                </div>

                {/* Buttons Row */}
                <div className="flex flex-wrap gap-2 mt-4">
                  <button className="flex items-center gap-1.5 px-4 py-2 rounded bg-[#248046] hover:bg-[#1a6334] text-white font-medium text-xs shadow transition-colors">
                    <span>🟢</span> Entrar en servicio
                  </button>
                  <button className="flex items-center gap-1.5 px-4 py-2 rounded bg-[#da373c] hover:bg-[#a1282c] text-white font-medium text-xs shadow transition-colors">
                    <span>🔴</span> Salir
                  </button>
                  <button className="flex items-center gap-1.5 px-4 py-2 rounded bg-[#4e5058] hover:bg-[#3f4147] text-white font-medium text-xs shadow transition-colors">
                    <span>📊</span> Mi Estado
                  </button>
                </div>
              </div>
            </div>

            {/* Commands Reference Table */}
            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
              <h2 className="text-lg font-bold text-white mb-4">Comandos Slash Implementados (`src/bot/commands.ts`)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">Comando</th>
                      <th className="py-3 px-4">Parámetros</th>
                      <th className="py-3 px-4">Permisos</th>
                      <th className="py-3 px-4">Descripción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    <tr>
                      <td className="py-3 px-4 font-bold text-indigo-400">/set-enterinserv</td>
                      <td className="py-3 px-4 text-slate-300">[canal: Canal]</td>
                      <td className="py-3 px-4 text-rose-400">Admin</td>
                      <td className="py-3 px-4 text-slate-300 font-sans">Envía el panel interactivo fijo al canal indicado.</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-bold text-indigo-400">/vincular</td>
                      <td className="py-3 px-4 text-slate-300">roblox_id: String</td>
                      <td className="py-3 px-4 text-emerald-400">Cualquiera</td>
                      <td className="py-3 px-4 text-slate-300 font-sans">Vincula directamente por ID de Roblox o nombre de usuario en tiempo real.</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-bold text-indigo-400">/servicio</td>
                      <td className="py-3 px-4 text-slate-500">Ninguno</td>
                      <td className="py-3 px-4 text-amber-400">Staff</td>
                      <td className="py-3 px-4 text-slate-300 font-sans">Consulta estado en tiempo real, cuenta de Roblox y horas de la semana.</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-bold text-indigo-400">/historial</td>
                      <td className="py-3 px-4 text-slate-300">[usuario: Usuario]</td>
                      <td className="py-3 px-4 text-amber-400">Staff / Admin</td>
                      <td className="py-3 px-4 text-slate-300 font-sans">Muestra los últimos 10 turnos con fechas exactas, duraciones y motivos.</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-bold text-indigo-400">/horas-staff</td>
                      <td className="py-3 px-4 text-slate-300">[usuario], [periodo]</td>
                      <td className="py-3 px-4 text-amber-400">Staff</td>
                      <td className="py-3 px-4 text-slate-300 font-sans">Reporte de horas acumuladas hoy, semana, mes o histórico total.</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-bold text-indigo-400">/forzarsalida</td>
                      <td className="py-3 px-4 text-slate-300">usuario, [motivo]</td>
                      <td className="py-3 px-4 text-rose-400">Admin</td>
                      <td className="py-3 px-4 text-slate-300 font-sans">Cierra de emergencia una sesión atascada indicando el motivo.</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-bold text-indigo-400">/configurar</td>
                      <td className="py-3 px-4 text-slate-300">rol_staff, [canal]</td>
                      <td className="py-3 px-4 text-rose-400">Admin</td>
                      <td className="py-3 px-4 text-slate-300 font-sans">Define el rol de staff autorizado y el canal predeterminado del panel.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ROBLOX LUAU */}
        {activeTab === 'roblox' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Guide Card */}
            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
              <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Gamepad2 className="h-5 w-5 text-amber-400" /> Integración en Roblox Studio (2 Archivos)
              </h2>
              <p className="text-xs text-slate-300 mb-6">
                Los dos scripts generados se instalan en segundos y se auto-configuran sin necesidad de crear manualmente instancias en ReplicatedStorage.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* File 1: ServerScriptService */}
                <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-xs font-semibold text-amber-400">
                        roblox/StaffService.server.lua
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                        ServerScriptService
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Script de servidor que envía la presencia de todos los jugadores cada 25 segundos a <code>/api/roblox/presence</code> y atiende el <code>StaffLinkEvent</code> haciendo llamadas autenticadas con <code>ROBLOX_API_KEY</code>.
                    </p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-500">HttpService habilitado</span>
                    <button
                      onClick={() => copyToClipboard('roblox/StaffService.server.lua', 'server_lua')}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedKey === 'server_lua' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      Copiar ruta
                    </button>
                  </div>
                </div>

                {/* File 2: StarterPlayerScripts */}
                <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-xs font-semibold text-indigo-400">
                        roblox/LinkClient.client.lua
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                        StarterPlayerScripts
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      LocalScript que crea automáticamente una interfaz gráfica moderna (ScreenGui) con botón flotante <code>🔗 Vincular Discord</code> y ventana modal con validación de código de 6 caracteres.
                    </p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-500">UI Auto-generada</span>
                    <button
                      onClick={() => copyToClipboard('roblox/LinkClient.client.lua', 'client_lua')}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedKey === 'client_lua' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      Copiar ruta
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Checklist */}
            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
              <h3 className="font-semibold text-white text-sm">Paso a Paso en Roblox Studio:</h3>
              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex items-start gap-2.5">
                  <div className="h-5 w-5 rounded bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 font-bold">1</div>
                  <span>En <strong>Game Settings &gt; Security</strong>, activa <strong>Allow HTTP Requests</strong> y guarda.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="h-5 w-5 rounded bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 font-bold">2</div>
                  <span>Crea un Script en <strong>ServerScriptService</strong> llamado <code>StaffService</code> y pega <code>roblox/StaffService.server.lua</code>. Modifica <code>API_BASE_URL</code> con tu dominio de Railway y <code>ROBLOX_API_KEY</code>.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="h-5 w-5 rounded bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 font-bold">3</div>
                  <span>Crea un LocalScript en <strong>StarterPlayer &gt; StarterPlayerScripts</strong> llamado <code>LinkClient</code> y pega <code>roblox/LinkClient.client.lua</code>.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: API & DATABASE */}
        {activeTab === 'api' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Endpoints */}
              <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4">
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Server className="h-5 w-5 text-emerald-400" /> Endpoints de la API Fastify (`src/api/server.ts`)
                </h3>
                
                <div className="space-y-3 text-xs font-mono">
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">GET</span>
                      <span className="text-white">/health</span>
                    </div>
                    <p className="font-sans text-slate-400 text-[11px] pt-1">
                      Healthcheck usado por Railway para validar despliegue sin caída (ping a PostgreSQL).
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-bold">POST</span>
                      <span className="text-white">/api/roblox/presence</span>
                    </div>
                    <p className="font-sans text-slate-400 text-[11px] pt-1">
                      Latido periódico cada 25s desde Roblox. Actualiza <code>game_presence</code> y activa sesiones pendientes.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-bold">POST</span>
                      <span className="text-white">/api/roblox/link/verify</span>
                    </div>
                    <p className="font-sans text-slate-400 text-[11px] pt-1">
                      Canje de código temporal de 6 caracteres con validación de <code>robloxUserId</code> tomada del servidor.
                    </p>
                  </div>
                </div>
              </div>

              {/* Database Schema */}
              <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4">
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Database className="h-5 w-5 text-amber-400" /> Esquema PostgreSQL (`001_init.sql`)
                </h3>
                
                <div className="space-y-2.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                    <span className="font-mono font-bold text-amber-400">guild_config:</span>
                    <span className="text-slate-400 ml-1.5">Almacena rol del staff autorizado y mensajes del panel fijado.</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                    <span className="font-mono font-bold text-amber-400">roblox_links:</span>
                    <span className="text-slate-400 ml-1.5">Emparejamiento 1-a-1 entre <code>discord_id</code> y <code>roblox_user_id</code>.</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                    <span className="font-mono font-bold text-amber-400">link_codes:</span>
                    <span className="text-slate-400 ml-1.5">Hashes SHA-256 de códigos temporales de vinculación con expiración.</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                    <span className="font-mono font-bold text-amber-400">game_presence:</span>
                    <span className="text-slate-400 ml-1.5">Última presencia en línea (job_id, joined_at, last_seen_at).</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                    <span className="font-mono font-bold text-amber-400">service_sessions:</span>
                    <span className="text-slate-400 ml-1.5">Registro completo de turnos (pending, active, ended, duration_seconds).</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Railway Procfile & Start Command */}
            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
              <h3 className="font-bold text-white text-sm mb-3">Comando de Inicio de Producción (`package.json`)</h3>
              <div className="p-4 rounded-xl bg-slate-950 font-mono text-xs text-indigo-300 flex items-center justify-between border border-slate-800">
                <code>npm run migrate && npm run deploy-commands && tsx src/index.ts</code>
                <button
                  onClick={() => copyToClipboard('npm run migrate && npm run deploy-commands && tsx src/index.ts', 'start_cmd')}
                  className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'start_cmd' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  Copiar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: SIMULATOR */}
        {activeTab === 'simulator' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Play className="h-5 w-5 text-indigo-400" /> Simulador Interactivo de Turno de Staff
                  </h2>
                  <p className="text-xs text-slate-400">
                    Prueba el comportamiento exacto de los estados en la base de datos y la sincronización entre Discord y Roblox.
                  </p>
                </div>
                <button
                  onClick={handleSimReset}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reiniciar Simulación
                </button>
              </div>

              {/* State Monitor */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[11px] text-slate-500 uppercase font-bold tracking-wider">Estado de Cuenta</span>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${simStep === 'unlinked' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                    <span className="text-sm font-semibold text-white">
                      {simStep === 'unlinked' ? 'No Vinculada' : 'Vinculado (RobloxUser#123)'}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[11px] text-slate-500 uppercase font-bold tracking-wider">Estado de Sesión</span>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        simStep === 'in_game'
                          ? 'bg-emerald-500 animate-pulse'
                          : simStep === 'pending'
                          ? 'bg-amber-500 animate-bounce'
                          : simStep === 'ended'
                          ? 'bg-slate-500'
                          : 'bg-slate-700'
                      }`}
                    />
                    <span className="text-sm font-semibold text-white font-mono uppercase">
                      {simStep === 'in_game'
                        ? 'active'
                        : simStep === 'pending'
                        ? 'pending'
                        : simStep === 'ended'
                        ? 'ended'
                        : 'none'}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[11px] text-slate-500 uppercase font-bold tracking-wider">Presencia en Roblox</span>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {simStep === 'in_game' ? '🟢 Conectado (Job #9f8a...)' : '🔴 Desconectado'}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[11px] text-slate-500 uppercase font-bold tracking-wider">Tiempo Acumulado</span>
                  <div className="mt-1 text-sm font-semibold font-mono text-indigo-400">
                    {simStep === 'in_game' ? '1 h 24 min 12 s (Activo)' : simStep === 'ended' ? '1 h 24 min 12 s (Guardado)' : '0 s'}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 p-4 rounded-xl bg-slate-950 border border-slate-800/80">
                {simStep === 'unlinked' && (
                  <button
                    onClick={() => {
                      setSimCode('B8K-3M9');
                      setSimStep('code_generated');
                    }}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Key className="h-4 w-4" /> 1. Ejecutar /vincular en Discord
                  </button>
                )}

                {simStep === 'code_generated' && (
                  <button
                    onClick={() => setSimStep('linked')}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Gamepad2 className="h-4 w-4" /> 2. Ingresar código `{simCode}` en Roblox GUI
                  </button>
                )}

                {(simStep === 'linked' || simStep === 'ended') && (
                  <button
                    onClick={handleSimStart}
                    className="px-4 py-2 rounded-lg bg-[#248046] hover:bg-[#1a6334] text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <span>🟢</span> 3. Pulsar [Entrar en servicio] en Discord
                  </button>
                )}

                {simStep === 'pending' && (
                  <button
                    onClick={handleSimEnterGame}
                    className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Gamepad2 className="h-4 w-4" /> 4. Unirse al servidor de Roblox (Heartbeat detectado)
                  </button>
                )}

                {simStep === 'in_game' && (
                  <button
                    onClick={handleSimStop}
                    className="px-4 py-2 rounded-lg bg-[#da373c] hover:bg-[#a1282c] text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <span>🔴</span> 5. Pulsar [Salir] o desconectarse del juego
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-indigo-400" />
            <span className="text-slate-300 font-semibold">Roblox Staff Service & Discord Bot</span>
            <span>— Node.js 20+, TypeScript, Fastify v4, Discord.js v14, PostgreSQL</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Listo para Railway</span>
            <span>•</span>
            <span>Scripts Luau completos</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
