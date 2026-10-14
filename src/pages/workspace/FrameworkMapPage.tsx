import { useState } from 'react'
import { Badge, Select, Table, Tbody, Td, Th, Thead } from '../../components/ui'
import { Header } from './shared'
import { A2063_GOALS, APRM_AREAS, FRAMEWORK_MAP, FRAMEWORKS, SDG_GOALS, SDG_TARGETS, rowsForSdg, type FrameworkId } from '../../lib/framework-map'

export function FrameworkMapPage({ workspaceId }: { workspaceId: string }) {
  const [framework, setFramework] = useState('')
  const [sdg, setSdg] = useState('')
  const rows = (sdg ? rowsForSdg(sdg) : FRAMEWORK_MAP).filter(r => !framework || r.framework === framework)
  return (
    <div className="space-y-6">
      <Header title="Framework mapping" subtitle="How each CRAFT framework element contributes to the SDG targets, Agenda 2063 goals and APRM thematic areas. Use it to show one assessment serving several reporting obligations."
        back={{ to: '/app/workspaces/$workspaceId/dashboard', params: { workspaceId }, label: 'Dashboard' }} />
      <div className="flex flex-wrap gap-3">
        <div className="w-72"><Select label="Framework" placeholder="All frameworks" value={framework} onChange={setFramework} options={Object.entries(FRAMEWORKS).map(([value, label]) => ({ value, label }))} /></div>
        <div className="w-80"><Select label="SDG goal" placeholder="All SDGs" value={sdg} onChange={setSdg} options={Object.entries(SDG_GOALS).map(([value, label]) => ({ value, label: `SDG ${value} — ${label}` }))} /></div>
      </div>
      <p className="text-sm text-slate-600">{rows.length} element(s)</p>
      <Table><Thead><tr><Th>Framework</Th><Th>Element</Th><Th>SDG targets</Th><Th>Agenda 2063</Th><Th>APRM</Th></tr></Thead>
        <Tbody>{rows.map(r => (
          <tr key={`${r.framework}-${r.element}`}>
            <Td className="text-xs">{FRAMEWORKS[r.framework as FrameworkId]}</Td><Td>{r.label}</Td>
            <Td>{r.sdg.map(t => <Badge key={t} className="mb-1 mr-1 bg-sky-100 text-sky-800">{t} {SDG_TARGETS[t]}</Badge>)}</Td>
            <Td className="text-xs">{r.a2063.map(g => `${g} ${A2063_GOALS[g]}`).join('; ')}</Td>
            <Td className="text-xs">{r.aprm.map(a => APRM_AREAS[a]).join('; ')}</Td>
          </tr>))}</Tbody></Table>
      <p className="text-xs text-slate-500">SDG target titles are shortened; see the UN SDG indicator framework for official wording. The SPAR average is SDG indicator 3.d.1.</p>
    </div>
  )
}
