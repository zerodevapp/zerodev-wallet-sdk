import { Text, Wrapper } from '@zerodev/react-ui'
import { Fragment } from 'react'
import { TxHistoryItem } from '../components/TxHistoryItem'
import { MOCK_HISTORY } from '../mocks'
import type { TxHistoryEntry } from '../types'
import { groupByDay } from '../utils/groupByDay'

export interface HistoryProps {
  /** Activity feed, newest anywhere (sorted internally). Defaults to the
   * mock feed until the real activity source lands. */
  entries?: TxHistoryEntry[]
  /** Fired when a row is tapped. Rows are inert when omitted. */
  onSelectEntry?: (entry: TxHistoryEntry) => void
}

export function History({
  entries = MOCK_HISTORY,
  onSelectEntry,
}: HistoryProps) {
  const groups = groupByDay(entries)

  return (
    <div className="zd:flex zd:h-full zd:w-full zd:flex-col zd:gap-1 zd:pt-2 zd:pb-4">
      <Wrapper
        variant="ghost"
        className="zd:flex zd:w-full zd:flex-1 zd:flex-col zd:gap-1 zd:overflow-y-auto zd:rounded-2xl zd:p-2"
      >
        {groups.map((group) => (
          <Fragment key={group.label}>
            <div className="zd:flex zd:w-full zd:items-center zd:py-2 zd:pr-2">
              <Text className="zd:text-body3">{group.label}</Text>
            </div>
            {group.entries.map((entry) =>
              onSelectEntry ? (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onSelectEntry(entry)}
                  className="zd:w-full zd:cursor-pointer zd:text-left"
                >
                  <EntryRow entry={entry} />
                </button>
              ) : (
                <EntryRow key={entry.id} entry={entry} />
              ),
            )}
          </Fragment>
        ))}
      </Wrapper>
    </div>
  )
}

function EntryRow({ entry }: { entry: TxHistoryEntry }) {
  return <TxHistoryItem {...entry} />
}
