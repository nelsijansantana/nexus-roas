#!/usr/bin/env python3
"""
Nexus ROAS — Instalador Remoto
Installs Nexus ROAS on a client's VPS via SSH.
"""

import sys
import getpass

# Check for paramiko before anything else
try:
    import paramiko
except ImportError:
    print("Erro: paramiko não está instalado.")
    print("Instale com: pip install paramiko")
    sys.exit(1)

import time
import secrets
import string


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def banner():
    print()
    print("=" * 60)
    print("   Nexus ROAS — Instalador Remoto")
    print("=" * 60)
    print()


def prompt(label, default=None, hidden=False):
    """Prompt the user for a value, optionally with a default."""
    if default:
        display = f"{label} [{default}]: "
    else:
        display = f"{label}: "

    if hidden:
        value = getpass.getpass(display)
    else:
        value = input(display).strip()

    if not value and default is not None:
        return default
    return value


def generate_password(length=20):
    """Generate a secure random password."""
    alphabet = string.ascii_letters + string.digits + "!@#$%&*"
    return "".join(secrets.choice(alphabet) for _ in range(length))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def collect_inputs():
    """Interactively collect all required configuration values."""
    print("Preencha as informações abaixo. Campos com [padrão] aceitam Enter.\n")

    config = {}

    config["vps_ip"] = prompt("IP do VPS")
    while not config["vps_ip"]:
        print("  IP do VPS é obrigatório.")
        config["vps_ip"] = prompt("IP do VPS")

    config["ssh_port"] = prompt("Porta SSH", default="22")

    config["ssh_user"] = prompt("Usuário SSH", default="root")

    config["ssh_password"] = prompt("Senha SSH", hidden=True)
    while not config["ssh_password"]:
        print("  Senha SSH é obrigatória.")
        config["ssh_password"] = prompt("Senha SSH", hidden=True)

    config["app_domain"] = prompt("Domínio da aplicação (ex: app.cliente.com)")
    while not config["app_domain"]:
        print("  Domínio é obrigatório.")
        config["app_domain"] = prompt("Domínio da aplicação (ex: app.cliente.com)")

    config["admin_email"] = prompt("E-mail do admin")
    while not config["admin_email"]:
        print("  E-mail do admin é obrigatório.")
        config["admin_email"] = prompt("E-mail do admin")

    print("  (Deixe em branco para gerar automaticamente no servidor)")
    config["admin_password"] = prompt("Senha do admin (opcional)", hidden=True)
    if not config["admin_password"]:
        config["admin_password"] = ""  # server-side generation

    config["cf_account_id"] = prompt("Cloudflare Account ID")
    while not config["cf_account_id"]:
        print("  Cloudflare Account ID é obrigatório.")
        config["cf_account_id"] = prompt("Cloudflare Account ID")

    config["cf_api_token"] = prompt("Cloudflare API Token", hidden=True)
    while not config["cf_api_token"]:
        print("  Cloudflare API Token é obrigatório.")
        config["cf_api_token"] = prompt("Cloudflare API Token", hidden=True)

    return config


def confirm(config):
    """Show a confirmation screen with all non-secret values."""
    print()
    print("-" * 60)
    print("  Confirmação — verifique os dados antes de prosseguir")
    print("-" * 60)
    print(f"  VPS IP         : {config['vps_ip']}")
    print(f"  Porta SSH      : {config['ssh_port']}")
    print(f"  Usuário SSH    : {config['ssh_user']}")
    print(f"  Senha SSH      : {'*' * 8}")
    print(f"  Domínio        : {config['app_domain']}")
    print(f"  E-mail admin   : {config['admin_email']}")
    print(f"  Senha admin    : {'(auto-gerada no servidor)' if not config['admin_password'] else '*' * 8}")
    print(f"  CF Account ID  : {config['cf_account_id']}")
    print(f"  CF API Token   : {'*' * 8}")
    print("-" * 60)
    print()

    answer = input("Prosseguir com a instalação? [s/N]: ").strip().lower()
    return answer in ("s", "sim", "y", "yes")


def build_remote_command(config):
    """Build the shell command to run on the remote VPS."""
    admin_pass = config["admin_password"] if config["admin_password"] else ""

    # Escape single quotes in values that might contain them
    def esc(value):
        return value.replace("'", "'\\''")

    cmd = (
        "set -e\n"
        "mkdir -p /opt/nexus-roas\n"
        "if [ ! -f /opt/nexus-roas/install.sh ]; then\n"
        "  echo 'Baixando Nexus ROAS...'\n"
        "  curl -sSL https://github.com/nelsijansantana/nexus-roas/releases/latest/download/nexus-roas.tar.gz"
        " -o /tmp/nexus.tar.gz\n"
        "  tar -xzf /tmp/nexus.tar.gz -C /opt/nexus-roas --strip-components=1\n"
        "  rm /tmp/nexus.tar.gz\n"
        "fi\n"
        f"export APP_DOMAIN='{esc(config['app_domain'])}'\n"
        f"export ADMIN_EMAIL='{esc(config['admin_email'])}'\n"
        f"export ADMIN_PASSWORD='{esc(admin_pass)}'\n"
        f"export CF_ACCOUNT_ID='{esc(config['cf_account_id'])}'\n"
        f"export CF_API_TOKEN='{esc(config['cf_api_token'])}'\n"
        "bash /opt/nexus-roas/install.sh\n"
    )
    return cmd


def stream_output(channel):
    """Stream remote command output to stdout in real-time."""
    while True:
        if channel.recv_ready():
            data = channel.recv(4096).decode("utf-8", errors="replace")
            sys.stdout.write(data)
            sys.stdout.flush()

        if channel.recv_stderr_ready():
            data = channel.recv_stderr(4096).decode("utf-8", errors="replace")
            sys.stderr.write(data)
            sys.stderr.flush()

        if channel.exit_status_ready():
            # Drain any remaining output
            while channel.recv_ready():
                data = channel.recv(4096).decode("utf-8", errors="replace")
                sys.stdout.write(data)
                sys.stdout.flush()
            while channel.recv_stderr_ready():
                data = channel.recv_stderr(4096).decode("utf-8", errors="replace")
                sys.stderr.write(data)
                sys.stderr.flush()
            break

        time.sleep(0.1)

    return channel.recv_exit_status()


def run_installation(config):
    """Connect via SSH and run the installer on the remote VPS."""
    print()
    print(f"Conectando a {config['vps_ip']}:{config['ssh_port']} como {config['ssh_user']}...")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        client.connect(
            hostname=config["vps_ip"],
            port=int(config["ssh_port"]),
            username=config["ssh_user"],
            password=config["ssh_password"],
            timeout=30,
        )
    except paramiko.AuthenticationException:
        print("\nErro: Autenticação SSH falhou. Verifique usuário e senha.")
        return 1
    except paramiko.ssh_exception.NoValidConnectionsError:
        print(f"\nErro: Não foi possível conectar a {config['vps_ip']}:{config['ssh_port']}.")
        print("Verifique se o IP está correto e a porta SSH está aberta.")
        return 1
    except TimeoutError:
        print(f"\nErro: Timeout ao tentar conectar a {config['vps_ip']}.")
        print("Verifique se o VPS está online e acessível.")
        return 1
    except Exception as exc:
        print(f"\nErro de conexão inesperado: {exc}")
        return 1

    print("Conexão estabelecida. Iniciando instalação...\n")
    print("=" * 60)

    transport = client.get_transport()
    channel = transport.open_session()
    channel.set_combine_stderr(False)
    channel.get_pty()  # allocate a pseudo-terminal so install scripts behave correctly

    remote_cmd = build_remote_command(config)
    channel.exec_command(f"bash -c {repr(remote_cmd)}")

    exit_code = stream_output(channel)

    channel.close()
    client.close()

    print()
    print("=" * 60)

    if exit_code == 0:
        print()
        print("Instalação concluída com sucesso!")
        print(f"Acesse: https://{config['app_domain']}")
        print(f"Login : {config['admin_email']}")
        if not config["admin_password"]:
            print("Senha : gerada automaticamente — verifique os logs acima ou o arquivo .env no VPS.")
    else:
        print()
        print(f"A instalação terminou com código de erro: {exit_code}")
        print("Verifique os logs acima para detalhes.")

    return exit_code


def main():
    banner()

    config = collect_inputs()

    if not confirm(config):
        print("Instalação cancelada.")
        sys.exit(0)

    exit_code = run_installation(config)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
