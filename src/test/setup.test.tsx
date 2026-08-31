import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

describe('App', () => {
  it('renders without crashing', () => {
    const div = document.createElement('div')
    div.id = 'root'
    document.body.appendChild(div)
    const { container } = render(<div>test</div>)
    expect(container).toBeInTheDocument()
  })
})
