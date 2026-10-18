import { SearchX } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { paths } from '@/routes/paths'

interface NotFoundStateProps {
  title?: string
  description?: string
}

export function NotFoundState({
  title = 'Page not found',
  description = "The page you're looking for doesn't exist or has moved.",
}: NotFoundStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
      <SearchX className="size-8 text-muted-foreground" aria-hidden="true" />
      <h2 className="font-medium">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      <Button asChild variant="outline" className="mt-2">
        <Link to={paths.home}>Go home</Link>
      </Button>
    </div>
  )
}
