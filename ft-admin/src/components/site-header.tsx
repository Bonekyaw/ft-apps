import { useTranslation } from "react-i18next"
import { changeLanguage } from "@/lib/i18n"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { LanguagesIcon } from "lucide-react"

export function SiteHeader() {
  const { t, i18n } = useTranslation()

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{t("header.title")}</h1>

        {/* Language switcher */}
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <LanguagesIcon className="size-4" />
                <span className="hidden sm:inline">
                  {i18n.language === "my" ? t("common.myanmar") : t("common.english")}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => changeLanguage("en")}
                className={i18n.language === "en" ? "font-semibold" : ""}
              >
                {t("common.english")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => changeLanguage("my")}
                className={i18n.language === "my" ? "font-semibold" : ""}
              >
                {t("common.myanmar")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
