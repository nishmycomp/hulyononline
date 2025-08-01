//
// Copyright © 2023, 2024 Hardcore Engineering Inc.
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//

import TiptapTableCell from '@tiptap/extension-table-cell'
import { Plugin } from '@tiptap/pm/state'

import { type Node } from '@tiptap/pm/model'
import { CellSelection, type Rect, TableMap } from '@tiptap/pm/tables'
import { TableColumnHandlerDecorationPlugin } from './decorations/columnHandlerDecoration'
import { TableColumnInsertDecorationPlugin } from './decorations/columnInsertDecoration'
import { TableRowHandlerDecorationPlugin } from './decorations/rowHandlerDecoration'
import { TableRowInsertDecorationPlugin } from './decorations/rowInsertDecoration'
import { TableDragMarkerDecorationPlugin } from './decorations/tableDragMarkerDecoration'
import { TableSelectionDecorationPlugin } from './decorations/tableSelectionDecoration'
import { findTable } from './utils'

export const TableCell = TiptapTableCell.extend({
  addProseMirrorPlugins () {
    return [
      TableSelectionNormalizerPlugin(),
      TableSelectionDecorationPlugin(this.editor),
      TableDragMarkerDecorationPlugin(this.editor),
      TableColumnHandlerDecorationPlugin(this.editor),
      TableColumnInsertDecorationPlugin(this.editor),
      TableRowHandlerDecorationPlugin(this.editor),
      TableRowInsertDecorationPlugin(this.editor)
    ]
  }
})

const TableSelectionNormalizerPlugin = (): Plugin<any> => {
  return new Plugin({
    appendTransaction: (transactions, oldState, newState) => {
      const selection = newState.selection
      if (selection.eq(oldState.selection) || !(selection instanceof CellSelection)) return

      const table = findTable(newState.selection)
      if (table === undefined) return

      const tableMap = TableMap.get(table.node)

      let rect: Rect | undefined

      const walkCell = (pos: number): void => {
        const cell = tableMap.findCell(pos)
        if (cell === undefined) return

        if (rect === undefined) {
          rect = { ...cell }
        } else {
          rect.left = Math.min(rect.left, cell.left)
          rect.top = Math.min(rect.top, cell.top)

          rect.right = Math.max(rect.right, cell.right)
          rect.bottom = Math.max(rect.bottom, cell.bottom)
        }
      }

      selection.forEachCell((_node, pos) => {
        walkCell(pos - table.pos - 1)
      })
      if (rect === undefined) return

      const rectSelection: number[] = []
      for (let row = rect.top; row < rect.bottom; row++) {
        for (let col = rect.left; col < rect.right; col++) {
          rectSelection.push(tableMap.map[row * tableMap.width + col])
        }
      }
      rectSelection.forEach((pos) => {
        walkCell(pos)
      })

      if (rect === undefined) return

      // Original promemirror implementation of TableMap.positionAt skips rowspawn cells, which leads to unpredictable selection behaviour
      const firstCellOffset = cellPositionAt(tableMap, rect.bottom - 1, rect.right - 1, table.node)
      const lastCellOffset = cellPositionAt(tableMap, rect.top, rect.left, table.node)

      const firstCellPos = newState.doc.resolve(table.start + firstCellOffset)
      const lastCellPos = newState.doc.resolve(table.start + lastCellOffset)

      const reverseOrder = selection.$anchorCell.pos > selection.$headCell.pos
      const $head = reverseOrder ? lastCellPos : firstCellPos
      const $anchor = reverseOrder ? firstCellPos : lastCellPos

      const newSelection = new CellSelection($anchor, $head)

      if (newSelection.eq(newState.selection)) return

      return newState.tr.setSelection(new CellSelection($anchor, $head))
    }
  })
}

function cellPositionAt (tableMap: TableMap, row: number, col: number, table: Node): number {
  for (let i = 0, rowStart = 0; ; i++) {
    const rowEnd = rowStart + table.child(i).nodeSize
    if (i === row) {
      const index = col + row * tableMap.width
      const rowEndIndex = (row + 1) * tableMap.width
      return index === rowEndIndex ? rowEnd - 1 : tableMap.map[index]
    }
    rowStart = rowEnd
  }
}
