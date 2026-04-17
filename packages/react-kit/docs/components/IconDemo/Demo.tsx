import { Icon } from '../../../src/shared/components/Icon'

export default function IconDemo() {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      <Icon name="wallet" className="h-6 w-6 text-greyScale" />
      <Icon name="google" className="h-6 w-6" />
      <Icon name="email" className="h-6 w-6 text-greyScale" />
      <Icon name="check" className="h-6 w-6 text-greyScale" />
      <Icon name="copy" className="h-6 w-6 text-greyScale" />
      <Icon name="warning" className="h-6 w-6 text-greyScale" />
    </div>
  )
}
