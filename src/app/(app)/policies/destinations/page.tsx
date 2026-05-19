import { getDestinations } from './actions'
import { DestinationsClient } from './_components/destinations-client'

export default async function DestinationsPage() {
  const { destinations } = await getDestinations()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Destinations</h1>
        <p className="text-zinc-500 text-sm">Map where your data goes — classify every destination by trust level so your DLP policies know how much to allow, restrict, or block.</p>
      </div>
      <DestinationsClient initialDestinations={destinations} />
    </div>
  )
}
