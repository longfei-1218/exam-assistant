import { LeftOutlined } from '@ant-design/icons';
import {
  Button as AntButton,
  Card as AntCard,
  Checkbox as AntCheckbox,
  Drawer,
  Empty as AntEmpty,
  Form as AntForm,
  Input as AntInput,
  Progress as AntProgress,
  Radio as AntRadio,
  Select,
  Space as AntSpace,
  Spin as AntSpin,
  Tabs as AntTabs,
  Tag as AntTag,
  type ButtonProps as AntButtonProps,
  type CardProps as AntCardProps,
  type CheckboxProps as AntCheckboxProps,
  type EmptyProps,
  type FormProps as AntFormProps,
  type InputProps as AntInputProps,
  type RadioProps as AntRadioProps,
  type SpaceProps as AntSpaceProps,
  type TagProps as AntTagProps,
} from 'antd';
import {
  Children,
  isValidElement,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
} from 'react';

type ButtonSize = 'mini' | 'small' | 'middle' | 'large';
type ButtonFill = 'solid' | 'outline' | 'none';

export type ButtonProps = Omit<
  AntButtonProps,
  'color' | 'fill' | 'size' | 'type' | 'variant'
> & {
  color?: 'primary' | 'danger' | 'default';
  fill?: ButtonFill;
  size?: ButtonSize;
  type?: 'button' | 'submit' | 'reset';
};

export function Button({
  color = 'default',
  fill = 'solid',
  size = 'middle',
  type = 'button',
  className = '',
  ...props
}: ButtonProps) {
  const variant =
    fill === 'outline' ? 'outlined' : fill === 'none' ? 'text' : 'solid';
  const antdSize =
    size === 'mini' || size === 'small'
      ? 'small'
      : size === 'large'
        ? 'large'
        : 'middle';

  return (
    <AntButton
      {...props}
      color={color}
      variant={variant}
      size={antdSize}
      htmlType={type}
      className={`app-button ${className}`}
    />
  );
}

type FormProps = Omit<AntFormProps, 'children'> & {
  children?: ReactNode;
  footer?: ReactNode;
};

function AppForm({ footer, children, ...props }: FormProps) {
  return (
    <AntForm {...props}>
      {children}
      {footer && <div className="mt-2">{footer}</div>}
    </AntForm>
  );
}

export const Form = Object.assign(AppForm, {
  useForm: AntForm.useForm,
  Item: AntForm.Item,
  List: AntForm.List,
  ErrorList: AntForm.ErrorList,
  useWatch: AntForm.useWatch,
});

type CardProps = Omit<AntCardProps, 'bodyStyle'> & {
  bodyClassName?: string;
};

export function Card({
  bodyClassName = '',
  className = '',
  children,
  ...props
}: CardProps) {
  return (
    <AntCard
      {...props}
      styles={{ body: { padding: 0 } }}
      className={`app-card rounded-2xl ${className}`}
    >
      <div className={bodyClassName}>{children}</div>
    </AntCard>
  );
}

type InputProps = Omit<AntInputProps, 'onChange'> & {
  clearable?: boolean;
  onChange?: (value: string) => void;
};

export function Input({
  clearable,
  onChange,
  ...props
}: InputProps) {
  return (
    <AntInput
      {...props}
      allowClear={clearable ?? props.allowClear}
      onChange={(event) => onChange?.(event.target.value)}
    />
  );
}

type TextAreaProps = Omit<
  ComponentProps<typeof AntInput.TextArea>,
  'onChange'
> & {
  onChange?: (value: string) => void;
};

export function TextArea({ onChange, ...props }: TextAreaProps) {
  return (
    <AntInput.TextArea
      {...props}
      onChange={(event) => onChange?.(event.target.value)}
    />
  );
}

type DatePickerProps = {
  value?: string | Date | null;
  onChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  title?: string;
  precision?: string;
};

function toDateInputValue(value: DatePickerProps['value']) {
  if (!value) {
    return '';
  }

  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return value.slice(0, 10);
}

export function DatePicker({
  value,
  onChange,
  disabled,
  className = '',
  title,
}: DatePickerProps) {
  return (
    <input
      type="date"
      aria-label={title}
      value={toDateInputValue(value)}
      disabled={disabled}
      onChange={(event) => onChange?.(event.target.value)}
      className={`h-9 w-full rounded-lg border border-[#d9d9d9] bg-white px-3 text-sm text-[#26292e] outline-none transition focus:border-[#3d7eff] ${className}`}
    />
  );
}

export function NavBar({
  onBack,
  right,
  children,
}: {
  onBack?: () => void;
  back?: null;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#f0f1f3] bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-12 w-full max-w-[560px] items-center px-3">
        <div className="flex w-20 shrink-0 items-center">
          {onBack && (
            <button
              type="button"
              aria-label="返回"
              className="grid h-9 w-9 place-items-center rounded-full bg-transparent text-[#26292e] transition hover:bg-[#f4f5f7]"
              onClick={onBack}
            >
              <LeftOutlined />
            </button>
          )}
        </div>
        <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold text-[#26292e]">
          {children}
        </h1>
        <div className="flex min-w-20 shrink-0 items-center justify-end">
          {right}
        </div>
      </div>
    </header>
  );
}

export function Popup({
  visible,
  onMaskClick,
  bodyStyle,
  children,
}: {
  visible: boolean;
  onMaskClick?: () => void;
  position?: 'bottom';
  bodyStyle?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <Drawer
      open={visible}
      onClose={onMaskClick}
      placement="bottom"
      size="auto"
      closable={false}
      styles={{
        body: { padding: 0 },
        section: { borderRadius: '16px 16px 0 0' },
      }}
    >
      <div style={bodyStyle}>{children}</div>
    </Drawer>
  );
}

export function SpinLoading({ color }: { color?: string }) {
  return <AntSpin size="large" style={{ color }} />;
}

export function ProgressBar({
  percent,
  className = '',
}: {
  percent: number;
  className?: string;
}) {
  return (
    <AntProgress
      percent={percent}
      showInfo={false}
      strokeColor="#3d7eff"
      railColor="#f0f1f3"
      className={className}
    />
  );
}

type TagColor =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger';

export function Tag({
  color = 'default',
  fill,
  className = '',
  children,
  ...props
}: Omit<AntTagProps, 'color'> & {
  color?: TagColor;
  fill?: 'outline' | 'solid';
}) {
  const mappedColor =
    color === 'primary'
      ? 'processing'
      : color === 'danger'
        ? 'error'
        : color;

  return (
    <AntTag
      {...props}
      color={mappedColor}
      bordered={fill !== 'solid'}
      className={className}
    >
      {children}
    </AntTag>
  );
}

export function Empty({ description, className = '', ...props }: EmptyProps) {
  return (
    <AntEmpty
      {...props}
      image={AntEmpty.PRESENTED_IMAGE_SIMPLE}
      description={description}
      className={className}
    />
  );
}

type ListProps = {
  header?: ReactNode;
  className?: string;
  children: ReactNode;
};

function ListRoot({ header, className = '', children }: ListProps) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-[#f0f1f3] bg-white ${className}`}
    >
      {header && (
        <div className="border-b border-[#f0f1f3] px-4 py-3 text-sm font-medium text-[#26292e]">
          {header}
        </div>
      )}
      <div className="divide-y divide-[#f0f1f3]">{children}</div>
    </section>
  );
}

function ListItem({
  description,
  extra,
  onClick,
  children,
  className = '',
}: {
  description?: ReactNode;
  extra?: ReactNode;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={() => onClick?.()}
      onKeyDown={(event) => {
        if (onClick && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onClick();
        }
      }}
      className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition hover:bg-[#fafbfc] ${className}`}
    >
      <div className="min-w-0 flex-1">
        <div>{children}</div>
        {description}
      </div>
      {extra && (
        <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
          {extra}
        </div>
      )}
    </div>
  );
}

export const List = Object.assign(ListRoot, { Item: ListItem });

function GridRoot({
  columns = 1,
  gap = 8,
  className = '',
  children,
}: {
  columns?: number;
  gap?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap,
      }}
    >
      {children}
    </div>
  );
}

function GridItem({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

export const Grid = Object.assign(GridRoot, { Item: GridItem });

function RadioGroup({
  value,
  onChange,
  disabled,
  children,
}: {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <AntRadio.Group
      value={value}
      disabled={disabled}
      onChange={(event) => onChange?.(event.target.value)}
      className="flex w-full flex-col gap-3"
    >
      {children}
    </AntRadio.Group>
  );
}

function RadioItem(props: AntRadioProps) {
  return <AntRadio {...props} />;
}

export const Radio = Object.assign(RadioItem, { Group: RadioGroup });

function CheckboxGroup({
  value,
  onChange,
  disabled,
  children,
}: {
  value?: string[];
  onChange?: (value: string[]) => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <AntCheckbox.Group
      value={value}
      disabled={disabled}
      onChange={(values) => onChange?.(values.map(String))}
      className="flex w-full flex-col gap-3"
    >
      {children}
    </AntCheckbox.Group>
  );
}

function CheckboxItem(props: AntCheckboxProps) {
  return <AntCheckbox {...props} />;
}

export const Checkbox = Object.assign(CheckboxItem, { Group: CheckboxGroup });

export function Space({
  block,
  className = '',
  ...props
}: AntSpaceProps & { block?: boolean }) {
  return (
    <AntSpace
      {...props}
      className={`${block ? 'flex w-full' : ''} ${className}`}
    />
  );
}

type SelectOption = {
  label: ReactNode;
  value: string;
};

type PickerProps = {
  columns: SelectOption[][];
  value?: string[];
  onConfirm?: (value: string[]) => void;
  children?:
    | ReactNode
    | ((items: unknown, actions: { open: () => void }) => ReactNode);
};

export function Picker({
  columns,
  value = [],
  onConfirm,
}: PickerProps) {
  return (
    <Select
      value={value[0]}
      options={columns[0] ?? []}
      onChange={(nextValue) => onConfirm?.(nextValue ? [nextValue] : [])}
      placeholder="请选择"
      allowClear
      size="large"
      className="w-full"
    />
  );
}

type SelectorProps = {
  options: SelectOption[];
  value: string[];
  onChange?: (value: string[]) => void;
};

export function Selector({ options, value, onChange }: SelectorProps) {
  return (
    <Select
      value={value[0]}
      options={options}
      onChange={(nextValue) => onChange?.(nextValue ? [nextValue] : [])}
      placeholder="请选择"
      allowClear
      size="large"
      className="w-full"
    />
  );
}

type TabItemProps = {
  title: ReactNode;
  key?: string;
};

function TabItem(_props: TabItemProps) {
  void _props;
  return null;
}

function TabsRoot({
  activeKey,
  onChange,
  className = '',
  children,
}: {
  activeKey?: string;
  onChange?: (key: string) => void;
  className?: string;
  children: ReactNode;
}) {
  const items = Children.toArray(children)
    .filter(
      (child): child is React.ReactElement<TabItemProps> =>
        isValidElement(child),
    )
    .map((child) => ({
      key: String(child.key ?? child.props.title),
      label: child.props.title,
    }));

  return (
    <AntTabs
      activeKey={activeKey}
      onChange={onChange}
      items={items}
      className={className}
    />
  );
}

export const Tabs = Object.assign(TabsRoot, { Tab: TabItem });
