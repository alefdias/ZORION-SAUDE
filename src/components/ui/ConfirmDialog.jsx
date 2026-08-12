import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Componente de confirmação reutilizável.
 * Substitui o confirm() nativo que não funciona corretamente no Tauri.
 *
 * Props:
 *   open        - boolean
 *   onOpenChange - fn(bool)
 *   title       - string (ex: "Excluir medicamento")
 *   description - string (ex: "Tem certeza?...")
 *   onConfirm   - fn() chamada ao confirmar
 *   confirmLabel - string (default: "Excluir")
 *   destructive  - boolean (default: true — botão vermelho)
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title = "Confirmar ação",
  description = "Tem certeza que deseja continuar? Esta ação não pode ser desfeita.",
  onConfirm,
  confirmLabel = "Excluir",
  destructive = true,
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={destructive ? "bg-red-600 hover:bg-red-700 text-white" : ""}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
