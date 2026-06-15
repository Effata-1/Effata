import { redirect } from 'next/navigation'
import { pageById }  from '@/lib/nav'

export default function FoundationPage() {
  redirect(pageById('data-catalog').route)
}
