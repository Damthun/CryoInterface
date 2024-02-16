
import socket


VNA_PORT = 5025


def build_cmd(cmd: str) -> bytes:
    cmd = cmd
    return cmd.encode('utf-8')


def send_cmd(s: socket.socket, cmd: str):
    cmd = cmd.encode('utf-8')
    bytes_sent = s.sendall(cmd)
    return


def receive_bytes(s: socket.socket):
    junkheader = s.recv(1)
    print('1 :' + junkheader.decode('utf-8'))
    if junkheader.decode('utf-8') != '#':
        junk = s.recv(1)
        print(junk.decode('utf-8'))
    print(type(junkheader))

    numOfDigitsByte = s.recv(1)
    print(numOfDigitsByte)

    numOfDigits = numOfDigitsByte.decode('utf-8')
    print('3: ' + numOfDigits)

    numBytes = s.recv(int(numOfDigits))
    print(numBytes.decode('utf-8'))

    NumBytesStr = numBytes.decode('utf-8')

    data = s.recv(int(NumBytesStr))
    while len(data) < int(NumBytesStr):
        data += s.recv(1024)
    return NumBytesStr, data
