// Connection point in the circuit graph
export interface NodeData {
  id: string
  voltage: number       // Volts at this node
  isGround: boolean
  connectedTo: string[] // IDs of other nodes
}

export function createNode(id: string, isGround = false): NodeData {
  return { id, voltage: 0, isGround, connectedTo: [] }
}
