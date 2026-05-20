import { getDestinationsPageData } from './actions'
import { DestinationsClient } from './_components/destinations-client'

export default async function DestinationsPage() {
  const { enriched, custom } = await getDestinationsPageData()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Destinations</h1>
        <p className="text-zinc-500 text-sm">
          Map where your data goes — toggle destinations in scope and classify every one by trust level so your DLP policies know how much to allow, restrict, or block.
        </p>
      </div>
      <DestinationsClient initialEnriched={enriched} initialCustom={custom} />
    </div>
  )
}
