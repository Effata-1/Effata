import { getIdentityPageData } from './actions'
import { IdentityClient } from './_components/identity-client'

export default async function IdentityPage() {
  const { fields, fieldOrder } = await getIdentityPageData()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Identity Context</h1>
        <p className="text-muted-foreground/80 text-sm">
          Map your organisation&apos;s identity groups to DLP context fields — so the platform can distinguish expected data handling from risky behaviour based on who is performing the action.
        </p>
      </div>
      <IdentityClient initialFields={fields} fieldOrder={fieldOrder} />
    </div>
  )
}
