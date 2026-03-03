// ToolTray — guarded by machineStore, only enables tools at correct state
import { useRepairStore } from '../store/repairStore'
import type { ToolId, DischargeMethod } from '../store/repairStore'
import { useMachineStore } from '../store/machineStore'
import { LabState, isAtLeast } from '../state-machine/LabStateMachine'

const METHOD_TOOLS: Record<DischargeMethod, { id: ToolId; label: string; icon: string; desc: string }[]> = {
  resistor:    [
    { id: 'resistor_10k', label: '10kΩ', icon: '🟫', desc: 'Safe slow drain' },
    { id: 'resistor_1k',  label: '1kΩ',  icon: '🟫', desc: 'Faster drain' },
  ],
  screwdriver: [{ id: 'screwdriver',   label: 'Screwdriver',  icon: '🔧', desc: '<50V only' }],
  bulb:        [{ id: 'bulb_60w',       label: '60W Bulb',     icon: '💡', desc: 'Visual indicator' }],
  tool:        [{ id: 'discharge_tool', label: 'Pro Tool',     icon: '🔌', desc: 'Controlled' }],
}

export function ToolTray() {
  const { method, selectedTool, selectTool } = useRepairStore()
  const machineState = useMachineStore(s => s.machineState)
  const dispatch = useMachineStore(s => s.dispatch)
  const setSelectedTool = useMachineStore(s => s.setSelectedTool)
  const isPowerConnected = useMachineStore(s => s.context.isPowerConnected)

  const tools = METHOD_TOOLS[method]

  // Gate: only show tool tray when measurement is done
  const trayEnabled = isAtLeast(machineState, LabState.TOOL_READY) && !isPowerConnected
  const trayVisible = isAtLeast(machineState, LabState.POWER_OFF) && !isAtLeast(machineState, LabState.BOTH_CONNECTED)

  if (!trayVisible) return null

  const handleSelect = (toolId: ToolId) => {
    setSelectedTool(toolId)
    selectTool(toolId)
    dispatch('SELECT_TOOL')
  }

  return (
    <div className="fixed left-0 right-0 z-10 flex justify-center px-4"
         style={{ bottom: '228px' }}>
      <div className={`backdrop-blur border rounded-2xl px-3 py-2 flex items-center gap-3 shadow-xl transition-all ${
        trayEnabled
          ? 'bg-slate-800/95 border-slate-600'
          : 'bg-slate-900/70 border-slate-700 opacity-60'
      }`}>
        <div className="flex flex-col items-start">
          <span className="text-slate-400 text-[10px] font-mono">TOOLS</span>
          {!trayEnabled && (
            <span className="text-amber-500 text-[9px]">measure first</span>
          )}
        </div>

        {tools.map(tool => {
          const isSelected = selectedTool === tool.id
          return (
            <button
              key={tool.id}
              onClick={() => trayEnabled && handleSelect(tool.id)}
              disabled={!trayEnabled}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all active:scale-95 ${
                isSelected
                  ? 'bg-blue-600 shadow-lg shadow-blue-500/40 scale-105'
                  : trayEnabled
                    ? 'bg-slate-700 hover:bg-slate-600'
                    : 'bg-slate-800 cursor-not-allowed'
              }`}
            >
              <span className="text-lg">{tool.icon}</span>
              <span className="text-xs text-white font-medium">{tool.label}</span>
              <span className="text-[10px] text-slate-400">{tool.desc}</span>
            </button>
          )
        })}

        {/* Grab indicator — appears after tool selected */}
        {selectedTool && trayEnabled && (
          <div className="flex flex-col items-center gap-0.5 px-2">
            <div className="text-blue-400 text-xs animate-bounce">↑</div>
            <span className="text-[10px] text-blue-400 font-medium">Drag to terminal</span>
          </div>
        )}
      </div>
    </div>
  )
}
